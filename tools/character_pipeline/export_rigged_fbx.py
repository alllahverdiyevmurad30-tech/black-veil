"""Export an existing rigged GLB to FBX using Blender.
Run: blender --background --python tools/character_pipeline/export_rigged_fbx.py -- public/models/characters/elias_voss_rigged.glb
This converts the actual skeletal GLB; Blender is required and this script does not claim an export until Blender completes.
"""
import bpy, sys
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
src=Path(args[0] if args else 'public/models/characters/elias_voss_rigged.glb').resolve()
if not src.exists(): raise SystemExit(f'Missing rigged GLB: {src}')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(src))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
if not meshes or not rigs: raise SystemExit('Imported asset did not contain both mesh and armature')
for obj in bpy.context.scene.objects: obj.select_set(obj in meshes+rigs)
bpy.context.view_layer.objects.active=rigs[0]
out=src.with_suffix('.fbx')
bpy.ops.export_scene.fbx(filepath=str(out), use_selection=True, object_types={'ARMATURE','MESH'}, add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=True, path_mode='COPY', embed_textures=True)
print('FBX_EXPORT_OK',out)
print('Meshes:',len(meshes),'Armatures:',len(rigs),'Actions:',len(bpy.data.actions))
