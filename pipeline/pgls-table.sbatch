#!/bin/bash
# PGLS with Pagel's lambda for every lifespan test of the correlation table (docs/REVIEW_ANALYSES_PLAN.md, A3;
# D18) on the cluster host haumea, one array task per scope (32 scopes with lifespan tests). The cluster runs
# only code that is on main. Submit from the root of a checkout pulled from main:
#   sbatch --array=1-32 pipeline/pgls-table.sbatch
# Each task writes out/pgls/<scope>.tsv (":" in the scope's name becomes "_"); then, on the login node,
#   bun run pipeline/pgls-table.ts summarize out/pgls out/pgls-summary.tsv
#SBATCH --job-name=mitoage-pgls
#SBATCH --partition=compute
#SBATCH --account=itmz
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=1
#SBATCH --mem=6G
#SBATCH --time=02:00:00
#SBATCH --output=out/pgls/logs/%A_%a.log
set -eo pipefail
export PATH=/data/uq2347/bun/bin:$PATH
cd "$SLURM_SUBMIT_DIR"
mkdir -p out/pgls/logs
scope=$(bun run pipeline/pgls-table.ts scopes | sed -n "${SLURM_ARRAY_TASK_ID}p")
if [ -z "$scope" ]; then echo "no scope at index $SLURM_ARRAY_TASK_ID"; exit 1; fi
# git is not installed on the compute nodes: read the commit from .git directly.
echo "commit $(cat .git/refs/heads/main 2>/dev/null || cat .git/HEAD) scope $scope"
bun run pipeline/pgls-table.ts fit "$scope" "out/pgls/${scope//:/_}.tsv"
