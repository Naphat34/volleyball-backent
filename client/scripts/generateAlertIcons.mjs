import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CircleCheck, CircleX, TriangleAlert, Info, CircleHelp, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';
import { writeFile } from 'node:fs/promises';

// Generate at development time to avoid shipping React's server renderer to clients.
const icons = { success: CircleCheck, error: CircleX, warning: TriangleAlert, info: Info, question: CircleHelp };
const markup = Object.fromEntries(Object.entries(icons).map(([name, icon]) => [name,
    renderToStaticMarkup(createElement(icon, { size: 40, strokeWidth: 1.75, 'aria-hidden': true }))
]));
const scorerMarkup = Object.fromEntries(Object.entries({ arrowUp: ArrowUp, arrowRight: ArrowRight, arrowDown: ArrowDown })
    .map(([name, icon]) => [name, renderToStaticMarkup(createElement(icon, { size: 32, 'aria-hidden': true }))]));
await writeFile(new URL('../src/utils/i18n/alertIcons.js', import.meta.url),
    '// Generated from lucide-react by scripts/generateAlertIcons.mjs.\n' +
    `export const alertIcons = ${JSON.stringify(markup, null, 2)};\n` +
    `export const scorerIcons = ${JSON.stringify(scorerMarkup, null, 2)};\n`);
