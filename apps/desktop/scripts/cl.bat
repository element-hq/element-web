REM Batch file to aid in cross-compiling sqlcipher for Windows ARM64
REM Full path should be passed to Makefile.msc as NCC env var

setlocal
call "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvarsall.bat" %VSCMD_ARG_HOST_ARCH%
cl.exe %*
endlocal
