import * as migration_20260830_093215_initial from './20260830_093215_initial';

export const migrations = [
  {
    up: migration_20260830_093215_initial.up,
    down: migration_20260830_093215_initial.down,
    name: '20260830_093215_initial'
  },
];
