import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { z } from 'zod';

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function getHost() {
  return 'https://trade.blockberrypi.com';
}

export function getEnv() {
  const host = window.location.host;

  if (host === 'trade.blockberrypi.com') return 'production';
  if (host === 'trade-dev.blockberrypi.com') return 'development';

  return '';
}

const errorTypes = {
  'auth': 'AUTH ERROR',
  'api': 'API ERROR'
}

export function buildNotificationError(error, type, override) {

  const getTitle = (error, type, override) => {
    if (typeof type === 'string') {
      return errorTypes[type] || 'ERROR';
    }
    if (typeof error.title === 'string') return error.title.toUpperCase();
    if (typeof override?.title === 'string') return override.title;
    return 'ERROR';
  }

  return {
    color: 'red',
    title: getTitle(error, type, override),
    message: error.message ? `${error.message} ${error.error_code ? `- Code: ${error.error_code}` : ''}` : 'Something went wrong!',
    ...override
  }
}

const successTypes = {
  'api': 'API SUCCESS'
};

export function buildNotificationSuccess(message, type, override) {

  const getTitle = (message, type, override) => {
    if (typeof type === 'string') {
      return successTypes[type] || 'SUCCESS';
    }
    if (typeof message?.title === 'string') return message.title.toUpperCase();
    if (typeof override?.title === 'string') return override.title;
    return 'SUCCESS';
  }

  const getMessage = (message) => {
    if (typeof message === 'string') return message;
    if (typeof message?.message === 'string') return message.message;
    return 'Your request has been successfully completed!';
  }

  return {
    color: 'green',
    title: getTitle(message, type, override),
    message: getMessage(message),
    ...override
  }
}

export function getZodSchema(json) {
  if (!json) return {};
  return Object.entries(json).reduce((schema, [key, value]) => {
    if (value.type === 'string') {
      return {...schema, [key]: z.string()}
    }
    if (value.type === 'number') {
      return {...schema, [key]: z.number()}
    }
    if (value.type === 'bool') {
      return {...schema, [key]: z.boolean()}
    }
    return schema;
  }, {})
}

export function getFormInitialValues(json) {
  if (!json) return {};
  return Object.entries(json).reduce((schema, [key, value]) => {
    if (value.type === 'string') {
      return {...schema, [key]: ''}
    }
    if (value.type === 'number') {
      return {...schema, [key]: 0}
    }
    if (value.type === 'bool') {
      return {...schema, [key]: false}
    }
    return schema;
  }, {})
}

export const getBrokersListByAccountType = (brokers, type) => {
  if (type === 'livetrading') {
    return brokers.map(broker => {
      if (broker.value === 'oktradesim') return { ...broker, disabled: true }
      return { ...broker, disabled: false };
    })
  }
  return brokers.map(broker => {
    if (broker.value === 'oktradesim') return { ...broker, disabled: false }
    return { ...broker, disabled: true };
  })
}

export const getStrategiesByAccountId = (strategies, accountId) => {
  return strategies.filter(strategy => strategy.accountId === accountId);
}