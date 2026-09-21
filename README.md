# yellow-jacket  
> Catch HTTP regressions before they sting.  
`yellow-jacket` is a developer-first HTTP regression testing tool inspired by  
Husky's local workflow.  
It executes declared HTTP routes and chained scenarios, stores known-good  
baselines, detects response regressions, measures API route coverage, and can  
block a Git push when an unexpected behavior change is detected.  
## Status  
Early development.  
Current capabilities:  
- GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS requests  
- status assertions  
- JSON and text response snapshots  
- structured response diffs  
- ignored dynamic values  
- secret redaction before snapshot persistence  
- chained HTTP scenarios  
- captured response variables  
- OpenAPI 3.x JSON route coverage  
- minimum coverage thresholds  
- JSON coverage output for CI and tooling  
- Git `pre-push` integration  
- zero runtime dependencies  
## Requirements  
- Node.js 24.12+  
- Git for hook installation  
## Development setup  
The package is not published to npm yet.  
Clone the repository and install dependencies:  
```bash  
git clone https://github.com/Loxime/yellow-jacket.git  
cd yellow-jacket  
npm install  
npm test  
npm link  
```  
After `npm link`, the `yellow-jacket` command is available locally.  
## Initialize a project  
From a project you want to test:  
```bash  
yellow-jacket init  
```  
This creates `yellow-jacket.config.mjs`.  
Example:  
```js  
import { defineConfig } from 'yellow-jacket';  
export default defineConfig({  
baseUrl:  
process.env.YELLOW_JACKET_URL ??  
'http://localhost:3000',  
timeoutMs: 10_000,  
compare: {  
ignore: [  
'$.createdAt',  
'$.updatedAt'  
],  
redact: [  
'$.token',  
'$.password'  
]  
},  
routes: [  
{  
name: 'home',  
method: 'GET',  
path: '/',  
expect: {  
status: 200  
}  
}  
]  
});  
```  
## Baselines  
Create a known-good baseline:  
```bash  
yellow-jacket baseline  
```  
Run the current application and compare it with the baseline:  
```bash  
yellow-jacket run  
```  
If an assertion fails or a regression is detected, yellow-jacket exits with  
code `1`.  
Example:  
```text  
triangle GET user  
$.name  
- "Maxime"  
+ "Max"  
```  
## Response comparison  
yellow-jacket compares HTTP status codes and response bodies.  
### Ignore dynamic values  
Dynamic fields can be ignored before comparison:  
```js  
compare: {  
ignore: [  
'$.createdAt',  
'$.users[*].requestId'  
]  
}  
```  
Ignored values are stored as:  
```text  
[IGNORED]  
```  
The field remains present in the snapshot, so yellow-jacket can still detect  
if it disappears unexpectedly.  
### Redact sensitive values  
Sensitive response values can be removed before snapshots are written:  
```js  
compare: {  
redact: [  
'$.token',  
'$.password'  
]  
}  
```  
Redacted values are stored as:  
```text  
[REDACTED]  
```  
This prevents newly generated baselines from persisting the original secret.  
Supported JSON paths currently include:  
```text  
$.createdAt  
$.user.profile.id  
$.users[0].id  
$.users[*].requestId  
```  
## Scenarios  
Scenarios chain HTTP requests when later requests depend on previous responses.  
```js  
scenarios: [  
{  
name: 'user lifecycle',  
steps: [  
{  
name: 'create user',  
method: 'POST',  
path: '/users',  
body: {  
name: 'Maxime'  
},  
expect: {  
status: 201  
},  
capture: {  
userId: '$.id'  
}  
},  
{  
name: 'read user',  
method: 'GET',  
path: '/users/{{userId}}',  
expect: {  
status: 200  
}  
},  
{  
name: 'update user',  
method: 'PATCH',  
path: '/users/{{userId}}',  
body: {  
id: '{{userId}}',  
name: 'Updated'  
},  
expect: {  
status: 200  
}  
},  
{  
name: 'delete user',  
method: 'DELETE',  
path: '/users/{{userId}}',  
expect: {  
status: 204  
}  
}  
]  
}  
]  
```  
Captured variables can be reused in:  
- paths  
- headers  
- JSON request bodies  
When a placeholder is the entire JSON value, the captured value keeps its  
original type.  
A failed request, unresolved variable or missing capture stops the remaining  
steps of that scenario.  
## OpenAPI coverage  
yellow-jacket can compare configured routes and scenario steps with an  
OpenAPI 3.x JSON route inventory.  
Configure the OpenAPI document:  
```js  
coverage: {  
openapi: './openapi.json'  
}  
```  
Run:  
```bash  
yellow-jacket coverage  
```  
Example:  
```text  
yellow-jacket coverage  
OK GET /users  
OK POST /users  
OK GET /users/{id}  
NO PATCH /users/{id}  
OK DELETE /users/{id}  
4 / 5 operations covered  
Coverage: 80%  
```  
The following route forms are normalized to the same path:  
```text  
/users/{id}  
/users/{{userId}}  
/users/:id  
```  
HTTP methods remain distinct.  
For example, covering:  
```text  
GET /users/{id}  
```  
does not cover:  
```text  
PATCH /users/{id}  
```  
## Coverage threshold  
A minimum coverage requirement can be configured:  
```js  
coverage: {  
openapi: './openapi.json',  
minimum: 80  
}  
```  
Successful result:  
```text  
Coverage: 83.33%  
Minimum: 80%  
Coverage requirement satisfied  
```  
A result below the configured minimum exits with code `1`, which makes the  
command suitable for CI.  
## JSON coverage output  
Machine-readable coverage output is available with:  
```bash  
yellow-jacket coverage --json  
```  
The report contains:  
- source  
- total operations  
- covered operations  
- uncovered operations  
- percentage  
- configured minimum  
- pass/fail state  
- individual OpenAPI operations  
## Git pre-push hook  
Install the Git hook:  
```bash  
yellow-jacket install  
```  
yellow-jacket creates:  
```text  
.yellow-jacket/  
nnn hooks/  
nnn pre-push  
```  
and configures the local repository with:  
```bash  
git config --local core.hooksPath .yellow-jacket/hooks  
```  
A normal push then runs:  
```text  
git push  
|  
v  
yellow-jacket run  
|  
+-- no regression -> push continues  
|  
+-- regression ----> push stops  
```  
Temporarily skip the hook with:  
```bash  
YELLOW_JACKET=0 git push  
```  
yellow-jacket does not overwrite an existing `core.hooksPath`, such as one  
managed by Husky.  
## Commands  
```text  
yellow-jacket init  
yellow-jacket install  
yellow-jacket baseline  
yellow-jacket run  
yellow-jacket coverage  
yellow-jacket coverage --json  
```  
## Repository synchronization  
Development remotes:  
```text  
origin https://github.com/Loxime/yellow-jacket.git  
gitlab https://gitlab.rusanor.fr/inquest/inquest-dev/yellow-jacket.git  
```  
Push the same commit to both repositories:  
```bash  
git push origin main  
git push gitlab main  
```  
## Roadmap  
```text  
HTTP runner  
|  
v  
baseline + structured diff  
|  
v  
scenario chaining  
|  
v  
Git pre-push integration  
|  
v  
OpenAPI coverage  
|  
v  
coverage CI contract  
|  
v  
additional route discovery  
|  
v  
GitHub / GitLab reporting  
|  
v  
HTML reports  
|  
v  
GitHub Pages documentation  
```  
