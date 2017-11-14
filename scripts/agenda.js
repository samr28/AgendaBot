// ================================================================================================
// Module dependencies
// ================================================================================================
const _               = require('underscore');
const uuidV4          = require('uuid/v4');
const utils           = require('./utils');
const REDIS_BRAIN_KEY = "agenda";

const DEFAULT_ATTACHMENT_COLOR = "secondary";
// ================================================================================================
// Module exports
// ================================================================================================
module.exports = {
  add               : add,
  rmByName          : rmByName,
  rmById            : rmById,
  update            : update,
  assign            : assign,
  unassign          : unAssign,
  setImportance     : setImportance,
  formatAgenda      : formatAgenda,
  getAgenda         : getAgenda,
  getAgendaSlack    : getAgendaSlack,
  listAgendaChannel : listAgendaChannel
};

// item = {id : int, value : String, important : bool, child : idOfOtherItem}
//
// TODO add error checking for all of these like in add

/**
 * Add an item to the agenda
 * @param {Object} robot Hubot Object
 * @param {String} value The value of the item to add
 */
function add(robot, value) {
  let item = {
    id        : uuidV4(),
    num       : getAgendaLength(robot),
    value     : value,
    color     : DEFAULT_ATTACHMENT_COLOR,
    moreInfo  : '',
    assignee  : '',
    important : false,
    child     : null
  };
  let resp = addBrainData(robot, item);
  if (utils.checkError(resp)) {
    return resp;
  }
  return `Added '${value}' to the agenda`;
}

/**
 * Remove an item by value/name
 * @param  {Object} robot Hubot Object
 * @param  {String} value Value of the item to remove
 */
function rmByName(robot, value) {
 removeBrainDataByName(robot, value);
 return `Removed '${value}' successfully`;
}

/**
 * Remove an item by id/number
 * @param  {Object} robot Hubot Object
 * @param  {Number} value ID of the item to remove
 */
function rmById(robot, id) {
  id++;
  if (getAgendaLength(robot) == 0) {
    console.log(new Error(`Tried to remove '${id}' but the agenda has no items!`));
    return new Error(`Tried to remove '${id}' but the agenda has no items!`);
  }
  if (id > getAgendaLength(robot)) {
    console.log(new Error(`Value '${id}' is out of bounds of ${getAgendaLength(robot)}`));
    return new Error(`There are only ${getAgendaLength(robot)} items. But you tried to remove item #${id}.`);
  }
  removeBrainDataById(robot, id-1);
  return `Removed #${id} successfully`;
}

/**
 * Change the value of an item
 * @param  {Object} robot Hubot object
 * @param  {number} id    ID of the item to modify
 * @param  {String} value What to change the value to
 */
function update(robot, id, value) {
  if (id > getAgendaLength(robot)) {
    console.log(new Error(`Value '${id}' is out of bounds of ${getAgendaLength(robot)}`));
    return new Error(`There are only ${getAgendaLength(robot)} items. But you tried to update item #${id-1}.`);
  }
  updateBrainData(robot, id, value);
  return `Updated #${id-1} successfully.`;
}

/**
 * Assign an item
 * @param  {Object} robot    Hubot object
 * @param  {number} id       Item ID
 * @param  {String} assignee User to assign to
 */
function assign(robot, id, assignee) {
  getAgenda(robot)[id].assignee = assignee;
  return `Successfully assigned #${id+1} to ${assignee}`;
}

/**
 * Reset the assignee field for an item
 * @param  {Object} robot Hubot object
 * @param  {number} id    Item ID
 */
function unAssign(robot, id) {
  if (getAgenda(robot)[id].assignee.length == 0) {
    return `Item #${id+1} is not assigned.`;
  }
  getAgenda(robot)[id].assignee = '';
  return `Successfully unassigned #${id+1}`;
}

/**
 * Set the importance of an item
 * @param {Object} robot      Hubot object
 * @param {number} id         Item ID
 * @param {String} importance Importance level (high, medium, low, default)
 */
function setImportance(robot, id, importance) {
  let color = '';
  if (importance === 'high') {
    color = 'danger';
  } else if (importance === 'medium') {
    color = 'warning';
  } else if (importance === 'low') {
    color = 'good';
  } else {
    color = DEFAULT_ATTACHMENT_COLOR;
  }
  getAgenda(robot)[id-1].color = color;
  return `Set item #${id} importance to ${importance}`;
}

function formatAgenda(agenda) {
  if (!agenda || _.isNull(agenda)) return new Error('Empty agenda');
  return { attachments : [{ text : agenda.sort().join('\n') }] };
}

function getAgenda(robot) {
  if (getBrainData(robot).length < 1) {
    return new Error('Empty agenda');
  }
  return getBrainData(robot);
}
function getAgendaLength(robot) {
  return getAgenda(robot).length;
}

function getBrainData(robot) {
  let brainData = robot.brain.get(REDIS_BRAIN_KEY);
  if (!brainData || _.isNull(brainData) || !_.isArray(brainData)) {
    return new Error('Invalid data from Redis brain.');
  }
  return brainData;
}
function setBrainData(robot, value) {
  return robot.brain.set(REDIS_BRAIN_KEY, value);
}
function clearBrainData(robot) {
  return robot.brain.set(REDIS_BRAIN_KEY, []);
}
function addBrainData(robot, newData) {
  let data = getBrainData(robot);
  if (!data || !_.isArray(data)) return new Error('Data from Redis brain is not valid!');
  data.push(newData);
  return setBrainData(robot, data);
}
function updateBrainData(robot, id, newData) {
  let data = getBrainData(robot);
  if (!data || !_.isArray(data)) return new Error('Data from Redis brain is not valid!');
  data[id] = newData;
  return setBrainData(robot, data);
}
function removeBrainDataByName(robot, name) {
  let data = getBrainData(robot);
  if (!data || !_.isArray(data)) return new Error('Data from Redis brain is not valid!');
  let found = -1;
  for (let i=0; i < data.length; i++) {
    if (data[i].value === name) {
      found = i;
    }
  }
  if (found === -1) {
    return new Error(`${name} is not currently on the agendaa.`);
  }
  data.splice(found, 1);
  console.dir(data);
  return setBrainData(robot, data);
}
function removeBrainDataById(robot, id) {
  console.log(`removeBrainDataById - ID: ${id}`);
  let data = getBrainData(robot);
  if (!data || !_.isArray(data)) return new Error('Data from Redis brain is not valid!');
  data.splice(id, 1);
  return setBrainData(robot, data);
}

function listAgendaChannel(robot, channel) {
  robot.messageRoom(channel, getAgendaSlack(robot));
}
function getAgendaSlack(robot) {
  let a = getAgenda(robot);
  if (utils.checkError(a)) return a;
  let niceAgenda = "";
  let attachments = [];
  for (let i=0; i < a.length; i++) {
    let item = a[i];
    let fields = [];
    if (item.moreInfo.length != 0) {
      fields.push({
        "title": "More info",
        "value": item.moreInfo,
        "short": false
      });
    }
    if (item.assignee.length != 0) {
      fields.push({
        "title": "Assignee",
        "value": item.assignee,
        "short": true
      });
    }
    attachments[i] = {
      "fallback": `${i+1}. ${item.value}`,
      "text": `${i+1}. ${item.value}`,
      "fields": fields,
      "color": item.color
    };
  }
  return {
    "attachments": attachments
  };
}
