import java.util.*;
import java.io.*;

public class QDEntry {
  public static void main(String[] args) {
    String wholeFilename = args[0];
    String partFilename = args[1];
    int offset = Integer.parseInt(args[2]);

    String whole;
    String part;

    try {
      whole = new Scanner(new File(wholeFilename)).useDelimiter("\\Z").next();
      part = new Scanner(new File(partFilename)).useDelimiter("\\Z").next();
    } catch (Exception e) {
      System.err.println("failure");
      System.err.println("failed with I/O error");
      return;
    }

    MainEntrance me = new MainEntrance(whole, part, offset);
    Map<Integer, String> res = null;

    try {
      res = me.Synthesize(true);

      if (res == null) {
        System.err.println("failure");
        System.err.println("Synthesize returned null");
      }
    } catch (Exception ex) {
      System.err.println("failure");
      System.err.println(ex.toString());
      return;
    }

    System.err.println("success");
    for (Map.Entry<Integer, String> entry : res.entrySet()) {
      System.err.printf("%d\t%s\n", entry.getKey(), entry.getValue());
    }
  }
}
