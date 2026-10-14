# BLACK VEIL — rigged character asset status

## Added in this repair
- `public/models/characters/elias_voss_rigged.glb`: generated glTF 2.0 binary with one skinned mesh, 18 humanoid joints, `JOINTS_0` + `WEIGHTS_0`, UV0, normals, one PBR material, and nine named animation clips (Idle, Walk, Run, Aim, Fire, Reload, Cover, Hit, Death).
- `src/character-assets.js`: `loadRiggedCharacterAsset()` loads glTF skin attributes into Three.js `SkinnedMesh`, creates a `Skeleton`, and creates `AnimationClip`s / `AnimationMixer` stored in `scene.userData`.
- `tools/character_pipeline/export_rigged_fbx.py`: Blender conversion/export script for FBX when Blender is installed.
- `public/models/characters/elias_voss_rigged_report.json`: generated asset metrics and limitations.

## Verification performed
- GLB binary/header/chunk/accessor bounds validated.
- Skin, joint count, required vertex attributes, and all nine animation clip definitions validated.
- JavaScript syntax check passed.
- Python syntax checks passed for both Blender pipeline scripts.
- `npm test` completed successfully three consecutive times; see `docs/test-runs/rigged-test-run-{1,2,3}.log`.

## Important limitations (not falsely marked complete)
- This is a procedural technical prototype/blockout, not a photoreal AAA character; geometry is ellipsoid-based and uses one material. UVs are generated per patch, not artist-authored production UVs; weight blending is generated automatically and needs deformation review.
- Blender is not installed in the current environment, so FBX was not generated, and the Blender exporter was syntax-checked only.
- No real browser/WebGL animation playback or Unreal Engine import was possible here. The new loader is exposed but the existing NPC replacement path still uses the legacy static loader; no claim is made that gameplay has switched to the rigged asset.
