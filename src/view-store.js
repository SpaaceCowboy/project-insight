import {flushSync} from 'react-dom';

// The existing rule controllers publish snapshots; React owns the rendered views.
const snapshots=new Map(), listeners=new Map();
export function getView(name) {return snapshots.get(name) ?? null}
export function subscribeView(name,listener) {
  if(!listeners.has(name))listeners.set(name,new Set());
  listeners.get(name).add(listener);
  return () => listeners.get(name).delete(listener);
}
export function renderView(name,props) {
  snapshots.set(name,{...props,revision:(snapshots.get(name)?.revision ?? 0)+1});
  flushSync(() => listeners.get(name)?.forEach(listener => listener()));
}
