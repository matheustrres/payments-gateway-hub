import { resolve } from 'node:path';

import { addAlias } from 'module-alias';

import { ENodeEnv } from '@/core/enums/node-env';

const isProd = process.env['NODE_ENV'] === ENodeEnv.Production.toString();

const root = process.cwd();
const src = resolve(root, 'src');

const path = isProd ? resolve(root, 'dist') : src;

addAlias('@', path);
