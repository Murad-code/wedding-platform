import * as migration_20260830_093215_initial from './20260830_093215_initial';
import * as migration_20261031_225842_media_storage_prefix from './20261031_225842_media_storage_prefix';

export const migrations = [
  {
    up: migration_20260830_093215_initial.up,
    down: migration_20260830_093215_initial.down,
    name: '20260830_093215_initial',
  },
  {
    up: migration_20261031_225842_media_storage_prefix.up,
    down: migration_20261031_225842_media_storage_prefix.down,
    name: '20261031_225842_media_storage_prefix',
  },
];
