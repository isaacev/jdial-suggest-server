const fs        = require('fs')
const path      = require('path')
const { spawn } = require('child_process')
const chalk     = require('chalk')

const verboseFlag = '--verbose'

console.log('===============================================================')
console.log(' |')
console.log(' |  WHAT THIS CHECK MEANS')
console.log(' |')
console.log(' |     A successful check DOES NOT indicate that there are no')
console.log(' |     bugs and DOES NOT indicate that all the code works.')
console.log(' |')
console.log(' |     A successful check indicates that this server is')
console.log(' |     PROBABLY set up enough to do basic work.')
console.log(' |')
console.log('===============================================================')

console.log('')
runChecks([
  checkNodeModulesNotEmpty,
  checkJava8Installation,
  checkBinNotEmpty,
  checkSketchOnPath,
  checkBasicSuggest,
]).then(() => console.log(''))

function printMessage (color, mark) {
  return (msg) => {
    let message = (typeof msg === 'string') ? msg : msg.message
    let verbose = (typeof msg === 'string') ? false : msg.verbose

    console.log('  ' + color(mark) + ' ' + message)

    if (verbose && flagIsSet(verboseFlag)) {
      console.log('\n' + color(verbose.trim()) + '\n')
    }
  }
}

function runChecks (checks) {
  return new Promise((resolve, reject) => {
    let check = checks.shift()

    if (check === undefined) {
      resolve()
    } else {
      check()
        .then(printMessage(chalk.green, '✓'))
        .catch(printMessage(chalk.red, '✗'))
        .then(() => {
          runChecks(checks)
            .then(resolve)
            .catch(reject)
        })
    }
  })
}

function checkJava8Installation () {
  return new Promise((resolve, reject) => {
    exec('which', [ 'java' ]).then((output) => {
      if (output.code !== 0 || output.stdout.length === 0) {
        // There is no program on the PATH with the name `java`.
        reject('Java does not seem to be installed ' +
          '(no program on PATH named `java`)')
      } else {
        exec('java', [ '-version' ]).then((output) => {
          if (output.code !== 0 || /\b1\.8\.\d/.test(output.stderr) === false) {
            // The Java version info didn't contain the sequence `1.8.\d`.
            reject({
              message: 'Java 8 does not seem to be installed (expected v1.8.x)',
              verbose: output.stderr,
            })
          } else {
            resolve('Java 8 seems to be installed')
          }
        }).catch(() => {
          reject('Java 8 does not seem to be installed (error calling `java`)')
        })
      }
    }).catch(() => {
      reject('Cannot determine if Java 8 is installed (error calling `which`)')
    })
  })
}

// Check that the `bin` directory exists and is not empty.
function checkBinNotEmpty () {
  return new Promise((resolve, reject) => {
    let dirPath = path.resolve(__dirname, './SkechObject/bin')
    return checkDirNotEmpty(dirPath)
      .then(resolve.bind(resolve, 'Java classes seem to be compiled'))
      .catch(reject.bind(reject, 'Java classes do not seem to be compiled ' +
        '(`./SkechObject/bin` could not be read or is empty)'))
  })
}

// Check the `node_modules` directory exists and is not empty.
function checkNodeModulesNotEmpty () {
  return new Promise((resolve, reject) => {
    let dirPath = path.resolve(__dirname, './node_modules')
    return checkDirNotEmpty(dirPath)
      .then(resolve.bind(resolve, 'Node modules seem to be installed'))
      .catch(reject.bind(reject, 'Node modules do not seem to be installed ' +
        '(`./node_modules` could not be read or is empty)'))
  })
}

function checkSketchOnPath () {
  const sketchPath = 'SkechObject/lib/sketch-1.7.2/sketch-frontend'
  const testFilePath = sketchPath + '/test/sk/seq/miniTest1.sk'
  const expectedOutput = `SKETCH version 1.7.2
Benchmark = SkechObject/lib/sketch-1.7.2/sketch-frontend/test/sk/seq/miniTest1.sk
/* BEGIN PACKAGE ANONYMOUS*/
/*miniTest1.sk:6*/

void reverse (bit[4] in, ref bit _out)/*miniTest1.sk:6*/
{
  _out = 0;
  _out = in[3];
  return;
}
/*miniTest1.sk:1*/

void reverseSketch (bit[4] in, ref bit _out)  implements reverse/*miniTest1.sk:1*/
{
  _out = 0;
  _out = 0 | ((in[3]) & 1);
  return;
}
/* END PACKAGE ANONYMOUS*/
[SKETCH] DONE`

  return new Promise((resolve, reject) => {
    exec('which', [ 'sketch' ]).then((output) => {
      if (output.code !== 0 || output.stdout.length === 0) {
        // There is no program on the PATH with the name `sketch`.
        reject({
          message: 'Sketch does not seem to be installed ' +
            '(no program on PATH named `sketch`)',
          verbose: `PATH="$PATH:\`pwd\`/${sketchPath}"`,
        })
      } else {
        exec('sketch', [ testFilePath ]).then((output) => {
          // Remove duration counter since this changes each execution and
          // will conflict with the expected output of this test.
          const result = output.stdout.replace(/Total time = \d+\s*$/, '').trim()

          if (output.code === 0 && result === expectedOutput.trim()) {
            resolve('Sketch seems to be installed and working')
          } else {
            reject({
              message: 'Sketch could not run a basic test',
              verbose: output.stdout,
            })
          }
        }).catch(() => {
          reject('Sketch does not seem to be installed (error calling `sketch`)')
        })
      }
    }).catch(() => {
      reject('Cannot determine if Sketch is available (error calling `which`)')
    })
  })
}

function checkBasicSuggest () {
  const expected = 'success\n11\tz = x + -x + y;'

  return new Promise((resolve, reject) => {
    const proc = spawn('java', [
      '-cp',
      'SkechObject/bin:JavaMeddler_ANTLR_PARSE/*',
      'QDEntry',
      './SkechObject/benchmarks/max3/max3-test',
      './SkechObject/benchmarks/max3/max3-target',
      '8',
      'false',
    ])

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (data) => { stdout += data })
    proc.stderr.on('data', (data) => { stderr += data })

    proc.on('close', (code) => {
      if (code === 0 && stderr.trim() === expected) {
        resolve('Executed simple suggestion')
      } else {
        if (flagIsSet(verboseFlag)) {
          reject({
            message: 'Error executing simple suggestion',
            verbose: stderr,
          })
        } else {
          reject('Error executing simple suggestion ' +
            '(re-run with `--verbose` to see error message)')
        }
      }
    })

    proc.on('error', (err) => {
      if (flagIsSet(verboseFlag)) {
        reject({
          message: 'Error executing simple suggestion',
          verbose: err.toString(),
        })
      } else {
        reject('Error executing simple suggestion ' +
          '(re-run with `--verbose` to see error message)')
      }
    })
  })
}

function exec (cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args)

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (data) => { stdout += data })
    proc.stderr.on('data', (data) => { stderr += data })

    proc.on('error', reject)
    proc.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function checkDirNotEmpty (dirPath) {
  return new Promise((resolve, reject) => {
    fs.stat(dirPath, (err, stats) => {
      if (err) {
        reject()
      } else if (stats.isDirectory() === false) {
        reject()
      } else {
        fs.readdir(dirPath, (err, files) => {
          if (err) {
            reject()
          } else if (files.length === 0) {
            // Expect directory to have some files.
            reject()
          } else {
            resolve()
          }
        })
      }
    })
  })
}

function flagIsSet (flag) {
  let argv = process.argv

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === flag) {
      return true
    }
  }

  return false
}
