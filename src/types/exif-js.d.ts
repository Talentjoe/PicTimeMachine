// exif-js has no official @types package; declare the minimal surface we use.
declare module 'exif-js' {
  interface ExifStatic {
    /** Reads EXIF tags from a raw image ArrayBuffer/binary file. */
    readFromBinaryFile(file: ArrayBuffer): Record<string, any>;
  }
  const EXIF: ExifStatic;
  export default EXIF;
}
