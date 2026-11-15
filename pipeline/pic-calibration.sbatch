#!/bin/bash
# The PIC calibration (docs/PIC_CALIBRATION.md) on the cluster host haumea, one array task per scope of the
# correlation table (32 scopes with lifespan tests). Submit from the root of a checkout pulled from main:
#   sbatch --array=1-32 pipeline/pic-calibration.sbatch
# Each task writes out/pic-calibration/<scope>.tsv (":" in the scope's name becomes "_").
#SBATCH --job-name=mitoage-pic
#SBATCH --partition=compute
#SBATCH --account=itmz
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=1
#SBATCH --mem=6G
#SBATCH --time=04:00:00
#SBATCH --output=out/pic-calibration/logs/%A_%a.log
set -eo pipefail
export PATH=/data/uq2347/bun/bin:$PATH
cd "$SLURM_SUBMIT_DIR"
mkdir -p out/pic-calibration/logs
scope=$(bun run pipeline/pic-calibration.ts scopes | sed -n "${SLURM_ARRAY_TASK_ID}p")
if [ -z "$scope" ]; then echo "no scope at index $SLURM_ARRAY_TASK_ID"; exit 1; fi
# git is not installed on the compute nodes: read the commit from .git directly.
echo "commit $(cat .git/refs/heads/main 2>/dev/null || cat .git/HEAD) scope $scope"
bun run pipeline/pic-calibration.ts calibrate "$scope" "out/pic-calibration/${scope//:/_}.tsv"
