-- Monthly contract scope: planned videos / posters and the contract period.
-- Nullable so existing contracts and single / child videos are unaffected.

ALTER TABLE "projects"
  ADD COLUMN "contractVideoCount" INTEGER,
  ADD COLUMN "contractPosterCount" INTEGER,
  ADD COLUMN "contractStartDate" TIMESTAMP(3),
  ADD COLUMN "contractEndDate" TIMESTAMP(3);
