import { IDependencyWarning } from './securityCheck';
import * as vscode from 'vscode';
import * as request from 'request';

interface IPackageBody {
  package?: any;
  shrinkwrap?: any;
  packagelock?: any;
}

interface IVulnerabilities {
  id: number;
  updated_at: string;
  created_at: string;
  publish_date: string;
  overview: string;
  recommendation: string;
  cvss_vector: string;
  cvss_score: number;
  module: string;
  version: string;
  vulnerable_versions: string;
  patched_versions: string;
  title: string;
  path: string[];
  advisory: string;
}

export interface IDependencyWarning {
  name: string;
  msg: string;
}

export enum LogType {
  full = 1,
  minimal
}

const API_URL = "https://api.nodesecurity.io/check";

export default class SecurityCheck {
  public static check(pkg: string, shrinkwrap: string, pkgLock: string, type: LogType = LogType.full): Promise<(string | IDependencyWarning)[]> {
    return new Promise<(string | IDependencyWarning)[]>((resolve, reject) => {
      let body: IPackageBody = {};

      // Check what needs to be added to the body
      if (pkg) {
        const pkgJson = JSON.parse(pkg);
        body["package"] = {
          name: pkgJson.name,
          dependencies: pkgJson.dependencies ? pkgJson.dependencies : {},
          devDependencies: pkgJson.devDependencies ? pkgJson.devDependencies : {}
        };
      }
      if (shrinkwrap) {
        body["shrinkwrap"] = shrinkwrap;
      }
      if (pkgLock) {
        body["packagelock"] = pkgLock;
      }

      // Do the request
      request.post(API_URL, { body: JSON.stringify(body) }, (err, response, body: string) => {
        if (err) {
          reject("Sorry, something went wrong checking your dependencies.")
        }

        if (body) {
          const result: IVulnerabilities[] = JSON.parse(body);
          // Filter out all duplicates
          const resultOutput = result.filter((vulnerability, pos, self) => self.indexOf(vulnerability) === pos).map(vulnerability => {
            if (type === LogType.full) {
              return `
Vulnerability found in: ${vulnerability.module}@${vulnerability.version}
  - Title: ${vulnerability.title}
  - Information: ${vulnerability.overview}
  - Common Vulnerability Scoring: ${vulnerability.cvss_score} ${this._getRating(vulnerability.cvss_score)}
  - Recommendation: ${vulnerability.recommendation}
  - Path: ${vulnerability.path.join(' > ')}
  - More info: ${vulnerability.advisory}
              `;
            } else {
              return {
                name: vulnerability.module,
                msg: `Vulnerability found in ${vulnerability.module}@${vulnerability.version}. ${vulnerability.overview}`
              };
            }
          });
          resolve(resultOutput);
        }
      });
    });
  }

  private static _getRating(score: number): string {
    if (score < 0.1) {
      return '(None)';
    } else if (score < 4) {
      return '(Low)';
    } else if (score < 7) {
      return '(Medium)';
    } else if (score < 9) {
      return '(High)';
    } else {
      return '(Critical)';
    }
  }
}