package main

import (
    "io/ioutil"
    "net/http"
    "os"
    "os/exec"
    "strconv"

    "github.com/gin-gonic/gin"
    "github.com/golang/glog"
)

const TMP_DIR string = "/tmp"

type SuggestionRequest struct {
    FullTrace    string `form:"full_trace" json:"full_trace" binding:"required"`
    Point        string `form:"modified_point" json:"modified_point" binding:"required"`
    PointIndex   int    `form:"modified_point_index" json:"modified_point_index" binding:"required"`
    FocusedLines []int  `form:"focused_lines" json:"focused_lines"`
}

func main() {
    var port string

    // Ensure that the PORT environment variable is set before proceeding
    if port = os.Getenv("PORT"); port == "" {
        glog.Fatal("$PORT must be set")
    }

    // Create a Gin router with default configuration
    r := gin.Default()

    r.POST("/", handleSuggestion)

    // Start the router listening for incoming requests on the specified port
    r.Run(":" + port)
}

func handleSuggestion (c *gin.Context) {
    var sugReq SuggestionRequest

    if c.BindJSON(&sugReq) != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": "malformed JSON fields",
        })
        return
    }

    var tmpTraceFile, tmpPointFile *os.File
    var tmpTraceFilename, tmpPointFilename string
    var err error

    if tmpTraceFile, err = ioutil.TempFile(TMP_DIR, "trace"); err != nil {
        glog.Fatal(err)
    } else {
        tmpTraceFilename = tmpTraceFile.Name()
        // defer os.Remove(tmpTraceFile.Name())
    }

    if tmpPointFile, err = ioutil.TempFile(TMP_DIR, "point"); err != nil {
        glog.Fatal(err)
    } else {
        tmpPointFilename = tmpPointFile.Name()
        // defer os.Remove(tmpPointFile.Name())
    }

    // Write the full trace string to a file
    fullTraceBuf := []byte(sugReq.FullTrace)

    if err = ioutil.WriteFile(tmpTraceFilename, fullTraceBuf, 0644); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "unable to process the full execution trace",
        })

        // Exit the handler early
        glog.Error(err)
        return
    }

    // WRite the modified execution point to a file
    pointBuf := []byte(sugReq.Point)

    if err = ioutil.WriteFile(tmpPointFilename, pointBuf, 0644); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "unable to process the modified execution point",
        })

        // Exit the handler early
        glog.Error(err)
        return
    }

    var cmdOut []byte
    focusedLinesStr := ""

    for i, lineNum := range sugReq.FocusedLines {
        if i > 0 {
            focusedLinesStr += ","
        }

        focusedLinesStr += strconv.Itoa(lineNum)
    }

    cmdName := "java"
    cmdArgs := []string{
        "-cp",
        "bin:JavaMeddler_ANTLR_PARSE/*:SkechObject/lib/*",
        "QDEntry",
        tmpTraceFilename,
        strconv.Itoa(sugReq.PointIndex),
        tmpPointFilename,
        "[" + focusedLinesStr + "]",
    }

    if cmdOut, err = exec.Command(cmdName, cmdArgs...).Output(); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "unable to make a suggestion",
        })

        // Exit the handler early
        glog.Error(err)
        return
    }

    c.String(http.StatusOK, string(cmdOut))
}
