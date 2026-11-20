#!/bin/bash
# The screen of every live record against independent sequences (RM25; pipeline/screen.ts), the comparing step,
# one array task per shard of the species. The cluster runs only code that is on main. In a checkout pulled from
# main, fetch the sequences first on the login node (network, light): bun run screen fetch
# then submit from its root:
#   sbatch --array=0-7 --account=ACCOUNT --nice=100 --comment '...' pipeline/screen.sbatch
# with bun on the PATH of the submitting shell (the job inherits it).
# Each task writes out/screen/shard-<k>.tsv; then, on the login node: bun run screen summarize out/screen
#SBATCH --job-name=mitoage-screen
#SBATCH --partition=compute
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=1
#SBATCH --mem=4G
#SBATCH --output=out/screen-logs/%A_%a.log
set -eo pipefail
cd "$SLURM_SUBMIT_DIR"
mkdir -p out/screen
n=$((SLURM_ARRAY_TASK_MAX + 1))
# git is not installed on the compute nodes: read the commit from .git directly.
echo "commit $(cat .git/refs/heads/main 2>/dev/null || cat .git/HEAD) shard $SLURM_ARRAY_TASK_ID of $n"
bun run pipeline/screen.ts compare "$SLURM_ARRAY_TASK_ID" "$n" "out/screen/shard-$SLURM_ARRAY_TASK_ID.tsv"
