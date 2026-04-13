import { IsObject } from "class-validator";
import type { LaunchClosureManifest } from "../launch-closure-pack";

export class LaunchClosureManifestDto {
  @IsObject()
  manifest!: LaunchClosureManifest;
}
