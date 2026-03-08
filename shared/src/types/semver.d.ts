declare module 'semver' {
  export class SemVer {
    constructor(version: string);
    major: number;
    minor: number;
    patch: number;
    prerelease: Array<string | number>;
  }

  export function coerce(version: string): SemVer | null;
  export function compare(v1: string, v2: string): number;

  const semver: {
    SemVer: typeof SemVer;
    coerce: typeof coerce;
    compare: typeof compare;
  };

  export default semver;
}
