Security Policy

Security is an important part of Huddle. We appreciate the security community and users who take the time to responsibly report potential vulnerabilities.

Supported Versions

Huddle is currently under active development and has not yet reached a stable release.

Security fixes are generally applied to the latest version available on the master branch.

Older commits, forks, unofficial builds, and modified deployments may not receive security updates.

Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues, discussions, pull requests, or other public channels.

If you believe you have discovered a security vulnerability in Huddle, please report it privately through GitHub Private Vulnerability Reporting in the Security section of this repository.

When submitting a report, please include as much of the following information as possible:

* A clear description of the vulnerability.
* The affected component or feature.
* Steps required to reproduce the issue.
* The potential security impact.
* Any relevant logs, screenshots, requests, responses, or proof-of-concept code.
* A suggested mitigation or fix, if available.

Please avoid including unnecessary personal data, credentials, access tokens, or other sensitive information in your report.

What to Report

Examples of security issues that should be reported privately include:

* Authentication or session bypasses.
* Authorization or permission vulnerabilities.
* Account takeover vulnerabilities.
* Cross-site scripting (XSS).
* Cross-site request forgery (CSRF), where applicable.
* SQL injection or other injection vulnerabilities.
* Server-side request forgery (SSRF).
* Unauthorized access to messages, servers, channels, files, or user information.
* WebSocket authentication or authorization vulnerabilities.
* WebRTC signaling vulnerabilities that could affect user security or privacy.
* Session, token, or WebSocket ticket leakage.
* Arbitrary file upload, file access, or path traversal vulnerabilities.
* Remote code execution.
* Exposure of secrets or sensitive information.
* Security vulnerabilities that could significantly affect the availability of a Huddle deployment.

General bugs, feature requests, performance problems, and issues without security implications should be reported through the regular GitHub issue tracker.

Responsible Disclosure

We ask security researchers to:

* Give us a reasonable amount of time to investigate and address a vulnerability before publicly disclosing it.
* Avoid accessing, modifying, deleting, or downloading data that does not belong to you.
* Avoid intentionally degrading or disrupting Huddle services or infrastructure.
* Test against your own Huddle deployment whenever possible.
* Stop testing and contact us if you unexpectedly gain access to sensitive or private information.

We will make a reasonable effort to:

* Acknowledge valid vulnerability reports.
* Investigate reported vulnerabilities.
* Keep reporters informed when appropriate.
* Release fixes for confirmed vulnerabilities according to their severity and impact.
* Credit researchers who responsibly disclose vulnerabilities, if they wish to be credited.

Security Updates

Security fixes may be released without prior public disclosure when early disclosure could put Huddle users or deployments at risk.

After a vulnerability has been addressed, relevant information may be published through GitHub Security Advisories or release notes when appropriate.

Scope

This policy applies to the official Huddle source code maintained under the project-huddle organization.

Third-party services, dependencies, unofficial deployments, forks, and modified versions of Huddle may have their own security policies and are outside the scope of this policy.

Contact

The preferred method for reporting vulnerabilities is GitHub Private Vulnerability Reporting.

If private vulnerability reporting is temporarily unavailable, please contact the Huddle maintainers privately rather than publishing the vulnerability.