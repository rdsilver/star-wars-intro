// Environment library index: the hot springs + eruption (env_spring.js) and
// therapy office / river sunset / title cards (env_other.js).
'use strict';
const spring = require('./env_spring');
const other = require('./env_other');
module.exports = { ...spring, ...other, lab: { ...(spring.lab || {}), ...(other.lab || {}) } };
