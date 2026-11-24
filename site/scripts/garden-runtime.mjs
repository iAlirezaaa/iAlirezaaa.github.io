import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
export function buildGarden(dist){execFileSync(process.execPath,[fileURLToPath(new URL('./build-garden.mjs',import.meta.url)),dist],{stdio:'inherit'})}
