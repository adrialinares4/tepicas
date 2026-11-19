import { leaguePage } from '../../src/pages.js';

export const onRequestGet = ({ request, env, params }) => leaguePage(request, env, params.code);
