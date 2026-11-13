# MitoAge build 1 (frozen snapshot)

The MitoAge build 1 database as released on 2015-07-01 and published in Toren et al. 2016,
Nucleic Acids Res 44(D1):D1262-D1265 (doi:10.1093/nar/gkv1187). Each file is one CSV of the full
database export converted to parquet **verbatim**: the same rows in the same order, the same column
names, the same values. A column is stored as a number only when every cell converts back to exactly
the same text; empty cells are null. This snapshot is immutable: later builds never rewrite it, and
the SHA-256 of each source CSV is listed below so the conversion can be checked.

Known problems are left in place here and corrected in build 2 (see `../changelog.parquet`, rows with
`scope = rule`):

- The base columns of every `*_base_composition` file are complement-labelled: column `G` holds the
  number of C on the RefSeq strand, `C` holds G, `A` holds T and `T` holds A. GC% is unaffected; GC
  and AT skews computed from these columns have the wrong sign.
- Features annotated as `join()` of segments (for example avian and turtle ND3 with an untranslated
  frameshift nucleotide) were counted over their full start..end span; build 2 counts the annotated
  segments only.
- The export has 923 species; the published release has 922. *Loxioides bailleui* (HAGRID 1598,
  NC_025626.1, 9,243 bp) is not a complete mitogenome and is excluded from every later build.

| file | rows | columns | SHA-256 of the source CSV |
| --- | ---: | ---: | --- |
| ATP6_base_composition.parquet | 920 | 26 | `d441c1ca02ac19a16056f03b9029b198a4179ba7fdfda7ad2d8c2091b0e92f5a` |
| ATP6_codon_usage.parquet | 920 | 90 | `6314e7d2bc42e2b42766e20b3acdd94b896f3e6d4b32bbdce49b439799a4b205` |
| ATP8_base_composition.parquet | 918 | 26 | `7d5ef5435a8f36e81717d58326250b5b642181dad48ee2ce5a65bb08ccb10532` |
| ATP8_codon_usage.parquet | 918 | 90 | `5206163b8e9ccf79b08bc6b954ae3b1cc6bfac7a8e530fadccf06563ae2c7145` |
| COX1_base_composition.parquet | 920 | 26 | `f38ba5530b0b7d2a8b6fc0adbbb2940037de6a16b84a6339e4e4c3bcba22a64b` |
| COX1_codon_usage.parquet | 920 | 90 | `c0d8c3c08eb3c5609979ec81c4050ead5694818b2231397d36db7e7ea94b045e` |
| COX2_base_composition.parquet | 920 | 26 | `33fa6ad7a5d7d2bead0fb86b129dda96849d3417d339da8d59f60718f7f573df` |
| COX2_codon_usage.parquet | 920 | 90 | `911926c5693760d27672401b9d9a925a44b224b22fd1c6ea7e7c85f764eb1d9f` |
| COX3_base_composition.parquet | 919 | 26 | `69d8b76d8e206a1d1a47f56ddebc8e1db93d972333994115e913107951763b28` |
| COX3_codon_usage.parquet | 919 | 90 | `127baeb4b7b50d84a6126de709a5e9529b399718eff42d493c0604663cec0261` |
| CYTB_base_composition.parquet | 917 | 26 | `da34533d9305ef8714cc73021758a93fe688ada06f6a8e0c0e479d1b3c2d1d5f` |
| CYTB_codon_usage.parquet | 917 | 90 | `070acc4f50a5f04ac96acbfaf0aee24cceaa3d94d034a541f3a20bc4a2c18725` |
| D_Loop_base_composition.parquet | 573 | 26 | `5be1a3526de1b68899f0a1e91e90c81d4795b3fb05db86e0eb6b3ab3f1e7a4f5` |
| ND1_base_composition.parquet | 920 | 26 | `f4b4a0aab3a4adfee8683df63eae28d5941978445409cf6008ed705bd9200dc7` |
| ND1_codon_usage.parquet | 920 | 90 | `1d48bde816219817553af5e2f030550a5a1d0d90ddfaaf440b08c302c11f33f4` |
| ND2_base_composition.parquet | 920 | 26 | `816374893f2944852f4d1861201eefe03bb07b8e171c52ae2cfdb6424555a2cf` |
| ND2_codon_usage.parquet | 920 | 90 | `b80044bbcd3bd507aaac716d42806afcafa89bb7641d8e5a473bc80ab6265087` |
| ND3_base_composition.parquet | 919 | 26 | `f5f17a5d7a94b8f3e5e2cbc39ed7a481d06486143e14b9883273dbdd0586ad41` |
| ND3_codon_usage.parquet | 919 | 90 | `c8fd6343da539e798994e54f38e064092029e4074383888bc5dbd17407e66d1f` |
| ND4L_base_composition.parquet | 919 | 26 | `173088246a610d18d94b5e50f17a6d99ce2f2eb4bcc4e7051a018cb07352524b` |
| ND4L_codon_usage.parquet | 919 | 90 | `63f17f5291f68afdb06c5bed9d479aa72ec31083282a45dc275fc1d50544502e` |
| ND4_base_composition.parquet | 919 | 26 | `5e5d683a724062552c30129f96641a4026f69bba1f4c1a459eb7f9d066b00885` |
| ND4_codon_usage.parquet | 919 | 90 | `f3d8e10426f03db0f7618958ee44017caf7146774390edc0b0b16eb654a5e89c` |
| ND5_base_composition.parquet | 918 | 26 | `5096b1b2e94a32dc7aabc20e9c433bab7791ed5e21634ec4bd21100ca392eddb` |
| ND5_codon_usage.parquet | 918 | 90 | `bfc3ab7f7e1f391b06d1af00e1b605bb3816e449c30096f89647efc5cc9623e8` |
| ND6_base_composition.parquet | 918 | 26 | `ff488a9c00cf5967ed0b8e09580876065c9762e29786e9d5c7bcb61c897cb17b` |
| ND6_codon_usage.parquet | 918 | 90 | `4647552ce0259f7bfa2c7eef32463386eac56d6b8f272164361285cc288844ea` |
| rRNA-12S_base_composition.parquet | 916 | 26 | `63b6a6a98618c9f0b3e9df6b9b1a40204fabefc40f43143b980a44750dab53b3` |
| rRNA-16S_base_composition.parquet | 920 | 26 | `6976dd66f1993129049a8213cea608f386908372fccefca05f01fc7561c90a48` |
| total_mtDNA_base_composition.parquet | 923 | 28 | `07a9eb0ff173983222ebf810110fb9c7b5dbd275fd285a08d07703572a91658f` |
| total_pc_base_composition.parquet | 920 | 26 | `6804c0c59565be72d256be7bd37bfce30a23b992e0467cd1589740558ad440f6` |
| total_pc_codon_usage.parquet | 920 | 90 | `0a2f454b2a42328a24c878237940b11f0a7338cbe99a95f680641867f021ea14` |
| total_rRNA_base_composition.parquet | 923 | 26 | `bed79302eb514cad8fe09ba21fd6efefb11d97b510b1762d6812d9d35b4adcdf` |
| total_tRNA_base_composition.parquet | 923 | 26 | `7b2917669d045952ddc8370cd06c90c684213d43156b869740bdc07818b3460f` |
