// react-cookies ships no type definitions; declare the minimal surface we use.
declare module 'react-cookies' {
  interface CookieOptions {
    path?: string;
    expires?: Date;
    maxAge?: number;
  }
  const cookie: {
    load(name: string): any;
    save(name: string, value: any, options?: CookieOptions): void;
    remove(name: string, options?: CookieOptions): void;
  };
  export default cookie;
}
