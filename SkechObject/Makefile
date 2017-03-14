classpath = bin:../JavaMeddler_ANTLR_PARSE/*:lib/*:../packages/*:.
factory   = src/constraintfactory

suggest:
	mkdir -p bin
	javac -cp $(classpath) QDEntry.java src/*.java src/**/*.java -d bin

run:
	java -cp bin:../JavaMeddler_ANTLR_PARSE/* QDEntry ../trace.txt ../point.txt 8

clean:
	rm -rf bin/constraintfactory
	rm -rf bin/javaparser
	rm -rf bin/jsonast
	rm -rf bin/jsonparser
	rm -rf bin/sketchobj
	rm -rf bin/visitor
	rm -rf *.class
