// Character library index: capybaras (capybara.js) + Gerald, Dr. Shelley, fish & extras (critters.js).
'use strict';
const capy = require('./capybara');
const critters = require('./critters');
module.exports = { ...capy, ...critters, lab: { ...(capy.lab || {}), ...(critters.lab || {}) } };
