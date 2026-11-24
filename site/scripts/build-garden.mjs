import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {buildGarden} from './garden-runtime.mjs'
const destination=process.argv[2]||fileURLToPath(new URL('../dist',import.meta.url))
buildGarden(path.resolve(destination))
