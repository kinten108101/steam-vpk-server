exec_config = configuration_data()
exec_config.set('APP_ID', 'com.github.kinten108101.SteamVPK.Server')
exec_config.set('GJS', gjs_console)
exec_config.set('VERSION', meson.project_version())
exec_config.set('PREFIX', get_option('prefix'))
exec_config.set('DATADIR', get_option('datadir'))
exec_config.set('LIBDIR', get_option('libdir'))
exec_config.set('BUILD_TYPE', get_option('buildtype'))

script = [
  'exports/addons.ts',
  'exports/dbus-service.ts',
  'exports/disk.ts',
  'exports/injector.ts',
  'exports/settings.ts',
  'exports/requestapi.ts',
  'exports/workshop.ts',
  'models/addon-storage.ts',
  'models/addons.ts',
  'models/download-queue.ts',
  'models/injection-store.ts',
  'models/profile-store.ts',
  'models/profile.ts',
  'services/archiver.ts',
  'services/disk-capacity.ts',
  'services/download-order.ts',
  'services/injector.ts',
  'services/settings.ts',
  'services/steam-api.ts',
  'steam-vpk-utils/dbus-utils.ts',
  'steam-vpk-utils/files.ts',
  'steam-vpk-utils/portals.ts',
  'steam-vpk-utils/utils.ts',
  'steam-vpk-utils/weakrefmap.ts',
  'const.ts',
  'file.ts',
  'id.ts',
  'index-dir.ts',
  'main.ts',
  'promisify.ts',
  'server.ts',
]
script_files = files(script)

tsc_out = meson.project_build_root() / 'tsc-out-server'

typescript_server = custom_target(
  'typescript-compile-server',
  input: script_files,
  build_by_default: true,
  build_always_stale: true,
  command: [ yarn, yarn_args, 'run', 'tsc',
    '--outDir', tsc_out,
    '--project', meson.project_source_root() / 'tsconfig.json',
    ],
  depends: [ yarn_deps ],
  output: [ 'tsc-output-server' ],
)

SRC = ''
foreach x : script
  SRC = ''.join([SRC, '<file>'])
  SRC = ''.join([SRC, x.replace('.ts', '.js')])
  SRC = ''.join([SRC, '</file>'])
endforeach

src_manifest = configure_file(
  input:  'resource.src.gresource.xml.in',
  output: 'resource.src.gresource.xml',
  configuration: {
    'SRC': SRC,
  },
)

src_resource = gnome.compile_resources(
  'com.github.kinten108101.SteamVPK.Server.src',
  src_manifest,
  dependencies: typescript_server,
  source_dir: tsc_out, # tsc_out / 'src'
  gresource_bundle: true,
  install: true,
  install_dir: server_pkgdatadir,
)

app_launcher = configure_file(
  input: 'index.js',
  output: 'com.github.kinten108101.SteamVPK.Server.js',
  configuration: exec_config,
)

install_data(
  app_launcher,
  rename: 'com.github.kinten108101.SteamVPK.Server',
  install_dir: get_option('bindir'),
  install_mode: 'rwxrwxrwx',
)
