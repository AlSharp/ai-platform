import { useState, useEffect, useRef } from 'react';
import { useLocalStorage } from '@mantine/hooks';

export const useMergeState = (initialState = {}) => {
  const [state, setState] = useState(initialState);

  const mergeState = newState => {
    if (typeof newState === 'function') newState = newState(state);

    setState(state => ({ ...state, ...newState }));
  }

  return [state, mergeState];
}

export const useGetLocalStorageValue = (key, timeout) => {

  const timeoutRef = useRef(null);

  const [finished, setFinished] = useState(false);
  const [value, _, removeValue] = useLocalStorage({
    key: key,
    defaultValue: '',
  });

  useEffect(() => {
    if (!value || value === '') return;
    const event = new CustomEvent(`on${key}`, { detail: { [key]: value } });
    window.dispatchEvent(event);
  }, [value])

  useEffect(() => {
    if (!finished) return;
    reset();
  }, [finished])

  const handler = (resolve, value) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setFinished(true);
    return resolve(value);
  }

  const reset = () => {
    removeValue();
    setFinished(false);
    timeoutRef.current = null;
    window.removeEventListener(`on${key}`, handler);
  }

  const getValue = () => new Promise((resolve, reject) => {
    timeoutRef.current = setTimeout(() => {
      reset();
      return reject(new Error(`Timeout: ${timeout} ms passed!`));
    }, timeout)

    window.addEventListener(`on${key}`, event => {
      handler(resolve, event.detail[key]);
    });
  })

  return getValue;
}