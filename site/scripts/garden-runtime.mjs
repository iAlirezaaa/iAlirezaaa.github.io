import {buildDigitalGarden} from '../../garden/scripts/build.mjs'
import {getBlogGardenNotes} from './garden-blog-content.mjs'
export function buildGarden(dist){return buildDigitalGarden(dist,getBlogGardenNotes(dist))}
