#! /usr/bin/env node

const fs          = require('fs')
const { spawn }   = require('child_process')
const tmp         = require('tmp')
const express     = require('express')
const bodyParser  = require('body-parser')
const winston     = require('winston')
const { logger }  = require('express-winston')
                    require('winston-daily-rotate-file')
const mkdirp      = require('mkdirp')
const httpStatus  = require('http-status-codes')

function createServer () {
  let transport = null
  if (process.env.LOG === 'stdout') {
    transport = new winston.transports.Console({
      json: true,
    })
  } else {
    mkdirp('./logs')
    transport = new winston.transports.DailyRotateFile({
      filename: './logs/log',
      datePattern: 'yyyy-MM-dd.',
      prepend: true,
      level: process.env.ENV === 'development' ? 'debug' : 'info',
    })
  }

  const app = express()
  app.use(bodyParser.json())
  app.use(logger({
    requestWhitelist: [ 'body' ],
    transports: [ transport ],
  }))

  return app
}

// Requires some top-level JSON field to exist and have
// a `typeof` that matches the `fieldType` parameter.
function req (fieldName, fieldType) {
  return function (req, res, next) {
    const body = req.body || {}

    if (typeof body[fieldName] !== fieldType) {
      let errMsg = { error: `missing "${fieldName}" field` }
      res.status(httpStatus.BAD_REQUEST).send(errMsg)
    } else {
      next()
    }
  }
}

function writeTmpFile (contents) {
  const tmpFile = tmp.fileSync()
  const stream = fs.createWriteStream(null, { fd: tmpFile.fd })
  stream.write(contents)

  return tmpFile
}

function runSuggest (trace, point, index) {
  const tmpTraceFile = writeTmpFile(trace)
  const tmpPointFile = writeTmpFile(point)

  const proc = spawn('java', [
    '-cp',
    'SkechObject/bin:JavaMeddler_ANTLR_PARSE/*',
    'QDEntry',
    tmpTraceFile.name,
    tmpPointFile.name,
    index.toString(),
  ])

  const deleteTmpFiles = () => {
    tmpTraceFile.removeCallback()
    tmpPointFile.removeCallback()
  }

  return [ proc, deleteTmpFiles ]
}

const port = process.env.PORT || 8080
const app = createServer()

app.post('/', [
  req('full_trace', 'string'),
  req('modified_point', 'string'),
  req('modified_point_index', 'number'),
], (req, res) => {
  let trace = req.body['full_trace']
  let point = req.body['modified_point']
  let index = req.body['modified_point_index']

  const [proc, deleteTmpFiles] = runSuggest(trace, point, index)

  let stdout = ''
  let stderr = ''
  proc.stdout.on('data', (data) => { stdout += data })
  proc.stderr.on('data', (data) => { stderr += data })

  proc.on('close', (code) => {
    deleteTmpFiles()

    if (code === 0) {
      try {
        res.status(httpStatus.OK).send(stderr)
      } catch (err) {
        const errMsg = { error: 'malformed program suggestion' }
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json(errMsg)
      }
    } else {
      const errMsg = { error: 'unexpected internal error' }
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json(errMsg)
    }
  })

  proc.on('error', () => {
    deleteTmpFiles()
    const errMsg = { error: 'unexpected internal error' }
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json(errMsg)
  })
})

app.listen(port)
console.log(`listening on port ${port}`)
