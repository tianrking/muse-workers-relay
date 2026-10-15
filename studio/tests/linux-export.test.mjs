import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const python = process.env.MORI_TEST_PYTHON || "python";
const available = spawnSync(python,["--version"]).status === 0;
test("Linux export combines official files, protects output and never prints credentials", {skip:!available}, async () => {
 const dir=await mkdtemp(join(tmpdir(),"mori-export-"));
 try {
 await writeFile(join(dir,"pairing.json"),JSON.stringify({access_token:"hatch-device-token:private-test",refresh_token:"hatch_refresh:private-test",api_url_v2:"https://ignored.example",username:"test"}));
 await writeFile(join(dir,"identity.json"),JSON.stringify({device_id:"hatch-link:test",private_key:"must-not-export"}));
 const out=join(dir,"mori-device.json");
 const args=["public/assets/mori-linux-export.py","--state-dir",dir,"--output",out];
 const result=spawnSync(python,args,{encoding:"utf8"});
 assert.equal(result.status,0,result.stderr);
 assert.ok(!result.stdout.includes("private-test"));
 const data=JSON.parse(await readFile(out,"utf8"));
 assert.deepEqual(Object.keys(data).sort(),["access_token","credential_source","device_id","refresh_token","username"]);
 assert.equal(data.device_id,"hatch-link:test");
 if(process.platform!=="win32") assert.equal((await stat(out)).mode & 0o777,0o600);
 assert.notEqual(spawnSync(python,args).status,0,"must not overwrite output");
 await writeFile(join(dir,"pairing.json"),JSON.stringify({access_token:"mgst_fake",refresh_token:"secret"}));
 const bad=spawnSync(python,[...args.slice(0,-1),join(dir,"rejected.json")],{encoding:"utf8"});
 assert.notEqual(bad.status,0);
 assert.ok(!bad.stderr.includes("mgst_fake"));
 await assert.rejects(readFile(join(dir,"rejected.json")));
 } finally { await rm(dir,{recursive:true,force:true}); }
});
