<#
.SYNOPSIS
    Runs gitingest using the python module.
.DESCRIPTION
    Wrapper script to run gitingest without needing it on the system PATH.
    Passes all arguments directly to gitingest.
.EXAMPLE
    ./scripts/gitingest.ps1 .
    ./scripts/gitingest.ps1 --help
#>

python -m gitingest $args
