@echo off
set appname=PicoBuild
set icon=Icon.ico
set output=Build/
electron-packager . --executable-name %appname% --icon %icon% --out %output% --overwrite