"""Blender-side finishing pass for BLACK VEIL static blockout GLBs.
Run with: blender --background --python tools/character_pipeline/blender_rig_uv_export.py -- public/models/characters/elias_voss_uv.glb
Creates a rigged GLB beside the input. Uses per-object rigid bone weights as a safe blockout rig,
not production-quality continuous skinning. Smart UV project is a starting unwrap, not hand-authored UVs.
"""
import bpy, sys, math
from pathlib import Path

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
source=Path(args[0] if args else 'public/models/characters/elias_voss_uv.glb').resolve()
if not source.exists(): raise FileNotFoundError(source)
out=source.with_name(source.stem.replace('_uv','')+'_rigged.glb')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
# UVs are generated per object; seams/packing and texel density still require an artist pass.
for obj in meshes:
    bpy.context.view_layer.objects.active=obj; obj.select_set(True)
    if not obj.data.uv_layers: obj.data.uv_layers.new(name='UVMap')
    try: bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(island_margin=0.012); bpy.ops.object.mode_set(mode='OBJECT')
    except Exception:
        if obj.mode!='OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
arm_data=bpy.data.armatures.new('BV_Humanoid_Armature'); arm=bpy.data.objects.new('BV_Humanoid_Armature',arm_data); bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm; arm.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
bones={
 'root':((0,0,0),(0,0,0.12),None),
 'hips':((0,.88,0),(0,1.04,0),'root'), 'spine':((0,1.04,0),(0,1.28,0),'hips'),
 'chest':((0,1.28,0),(0,1.56,0),'spine'), 'neck':((0,1.56,0),(0,1.70,0),'chest'), 'head':((0,1.70,0),(0,1.95,0),'neck'),
 'upper_arm.L':((-.27,1.52,0),(-.34,1.26,0),'chest'),'forearm.L':((-.34,1.26,0),(-.365,1.02,-.02),'upper_arm.L'),
 'hand.L':((-.365,1.02,-.02),(-.365,.94,-.04),'forearm.L'),
 'upper_arm.R':((.27,1.52,0),(.34,1.26,0),'chest'),'forearm.R':((.34,1.26,0),(.365,1.02,-.02),'upper_arm.R'),
 'hand.R':((.365,1.02,-.02),(.365,.94,-.04),'forearm.R'),
 'thigh.L':((-.115,.92,0),(-.12,.49,0),'hips'),'shin.L':((-.12,.49,0),(-.12,.16,0),'thigh.L'),'foot.L':((-.12,.16,0),(-.12,.04,-.16),'shin.L'),
 'thigh.R':((.115,.92,0),(.12,.49,0),'hips'),'shin.R':((.12,.49,0),(.12,.16,0),'thigh.R'),'foot.R':((.12,.16,0),(.12,.04,-.16),'shin.R')}
for name,(head,tail,parent) in bones.items():
 b=arm_data.edit_bones.new(name); b.head=head; b.tail=tail
 if parent: b.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT'); arm.select_set(False)
def bone_for(obj):
 n=obj.name.lower(); c=obj.matrix_world.translation
 if any(k in n for k in ('head','hair','eye','ear','nose','mouth','brow')): return 'head'
 if any(k in n for k in ('neck',)): return 'neck'
 if any(k in n for k in ('upperarm_l','shoulder_l','sleeve_l','earmuff_l','earpiece_-1')): return 'upper_arm.L'
 if any(k in n for k in ('upperarm_r','shoulder_r','sleeve_r','earmuff_1','earpiece_1')): return 'upper_arm.R'
 if 'forearm_l' in n or 'glove_l' in n or 'cuff_l' in n: return 'forearm.L'
 if 'forearm_r' in n or 'glove_r' in n or 'cuff_r' in n: return 'forearm.R'
 if any(k in n for k in ('thigh_l','knee_l','lower_trouser_l','boot_l','ankle_l')): return 'thigh.L' if c.y>.48 else 'shin.L'
 if any(k in n for k in ('thigh_r','knee_r','lower_trouser_r','boot_r','ankle_r')): return 'thigh.R' if c.y>.48 else 'shin.R'
 if any(k in n for k in ('pelvis','belt','utility_pouch','pouch_','trouser')): return 'hips' if c.y>.78 else ('shin.L' if c.x<0 else 'shin.R')
 if any(k in n for k in ('radio','pack','yoke','pocket','zipper','jacket','rescue_id','closure')): return 'chest' if c.y>1.1 else 'hips'
 return min(('head','chest','hips','upper_arm.L','upper_arm.R','thigh.L','thigh.R'),key=lambda bn:(VectorLike(bones[bn][0])-c).length)
class VectorLike:
 def __init__(self,v): self.x,self.y,self.z=v
 def __sub__(self,o): return VectorLike((self.x-o.x,self.y-o.y,self.z-o.z))
 @property
 def length(self): return math.sqrt(self.x*self.x+self.y*self.y+self.z*self.z)
for obj in meshes:
    bn=bone_for(obj); vg=obj.vertex_groups.new(name=bn); vg.add(list(range(len(obj.data.vertices))),1.0,'REPLACE')
    mod=obj.modifiers.new('BV_RigidBlockoutSkin','ARMATURE'); mod.object=arm
    obj.parent=arm
# Generated animation set for pipeline validation. These are blockout clips, not mocap or AAA final animation.
# Each action is retained as an NLA strip so glTF exports all named clips in one GLB.
arm.animation_data_create()
POSES = {
    'BV_Idle_Blockout': {'frames': (1, 13, 25), 'loop': True, 'bones': ('chest','head','upper_arm.L','upper_arm.R')},
    'BV_Walk_Blockout': {'frames': (1, 7, 13, 19, 25), 'loop': True, 'bones': ('chest','upper_arm.L','upper_arm.R','thigh.L','thigh.R','shin.L','shin.R')},
    'BV_Run_Blockout': {'frames': (1, 5, 9, 13, 17), 'loop': True, 'bones': ('chest','upper_arm.L','upper_arm.R','thigh.L','thigh.R','shin.L','shin.R')},
    'BV_Aim_Blockout': {'frames': (1, 8, 16), 'loop': False, 'bones': ('chest','head','upper_arm.L','upper_arm.R','forearm.L','forearm.R')},
    'BV_Fire_Blockout': {'frames': (1, 3, 7, 10), 'loop': False, 'bones': ('chest','upper_arm.L','upper_arm.R','forearm.L','forearm.R')},
    'BV_Reload_Blockout': {'frames': (1, 8, 18, 28, 36), 'loop': False, 'bones': ('chest','upper_arm.L','upper_arm.R','forearm.L','forearm.R','hand.L','hand.R')},
    'BV_Cover_Blockout': {'frames': (1, 8, 16), 'loop': False, 'bones': ('root','hips','chest','head','thigh.L','thigh.R','shin.L','shin.R')},
    'BV_Hit_Blockout': {'frames': (1, 3, 8, 14), 'loop': False, 'bones': ('chest','head','upper_arm.L','upper_arm.R','hips')},
    'BV_Death_Blockout': {'frames': (1, 8, 18, 30), 'loop': False, 'bones': ('root','hips','chest','head','upper_arm.L','upper_arm.R','forearm.L','forearm.R','thigh.L','thigh.R','shin.L','shin.R')},
}

def clip_pose(name, bone, frame, index, count):
    # Reset every keyed bone before applying the action-specific authored blockout pose.
    t = (frame - 1) / max(1, POSES[name]['frames'][-1] - 1)
    phase = t * math.tau
    side = -1 if bone.endswith('.L') else 1
    rot = [0.0, 0.0, 0.0]
    if name == 'BV_Idle_Blockout' and bone in ('chest','head'):
        rot[2] = 0.018 * math.sin(phase)
    elif name in ('BV_Walk_Blockout','BV_Run_Blockout'):
        amp = 0.32 if name == 'BV_Walk_Blockout' else 0.62
        if bone.startswith('thigh'): rot[0] = amp * math.sin(phase + (0 if side < 0 else math.pi))
        elif bone.startswith('shin'): rot[0] = max(0, amp * 0.9 * math.sin(phase + (0 if side < 0 else math.pi) + 0.7))
        elif bone.startswith('upper_arm'): rot[0] = -amp * 0.55 * math.sin(phase + (0 if side < 0 else math.pi))
        elif bone == 'chest': rot[2] = 0.035 * math.sin(phase * 2)
    elif name == 'BV_Aim_Blockout':
        if bone == 'chest': rot[0] = -0.12 * min(1, t * 4)
        elif bone.startswith('upper_arm'): rot[0] = -0.85 if bone.endswith('.R') else -0.72
        elif bone.startswith('forearm'): rot[0] = -0.55
        elif bone == 'head': rot[0] = -0.04
    elif name == 'BV_Fire_Blockout':
        pulse = math.sin(min(1, t * 2.8) * math.pi) if t < 0.36 else 0
        if bone == 'chest': rot[0] = 0.08 * pulse
        elif bone.startswith('upper_arm'): rot[0] = (-0.85 if bone.endswith('.R') else -0.72) + 0.11 * pulse
        elif bone.startswith('forearm'): rot[0] = -0.55 + 0.16 * pulse
    elif name == 'BV_Reload_Blockout':
        lift = math.sin(math.pi * min(1, t * 1.8))
        if bone.startswith('upper_arm'): rot[0] = -0.45 - 0.35 * lift
        elif bone.startswith('forearm'): rot[0] = -0.35 - 0.7 * lift
        elif bone.startswith('hand'): rot[0] = -0.2 * lift
        elif bone == 'chest': rot[0] = -0.04 * lift
    elif name == 'BV_Cover_Blockout':
        crouch = math.sin(math.pi * min(1, t * 1.8))
        if bone == 'root': rot[0] = 0.06 * crouch
        elif bone == 'hips': rot[0] = 0.16 * crouch
        elif bone.startswith('thigh'): rot[0] = -0.48 * crouch
        elif bone.startswith('shin'): rot[0] = 0.72 * crouch
        elif bone == 'chest': rot[0] = -0.12 * crouch
    elif name == 'BV_Hit_Blockout':
        pulse = math.sin(math.pi * min(1, t * 2.2))
        if bone == 'chest': rot[0] = 0.22 * pulse
        elif bone == 'head': rot[2] = 0.14 * pulse
        elif bone.startswith('upper_arm'): rot[2] = side * 0.18 * pulse
        elif bone == 'hips': rot[2] = -0.08 * pulse
    elif name == 'BV_Death_Blockout':
        fall = min(1, t * 1.45); eased = fall * fall * (3 - 2 * fall)
        if bone == 'root': rot[2] = 0.1 * eased
        elif bone == 'hips': rot[0] = 0.35 * eased
        elif bone == 'chest': rot[0] = 0.8 * eased
        elif bone == 'head': rot[0] = 0.18 * eased
        elif bone.startswith('upper_arm'): rot[0] = (-0.9 if bone.endswith('.L') else -0.65) * eased
        elif bone.startswith('forearm'): rot[0] = 0.5 * eased
        elif bone.startswith('thigh'): rot[0] = (-0.3 if bone.endswith('.L') else 0.45) * eased
        elif bone.startswith('shin'): rot[0] = 0.35 * eased
    return rot

for action_name, spec in POSES.items():
    action = bpy.data.actions.new(action_name)
    arm.animation_data.action = action
    for bn in spec['bones']:
        pb = arm.pose.bones.get(bn)
        if not pb: continue
        pb.rotation_mode = 'XYZ'
        for idx, frame in enumerate(spec['frames']):
            pb.rotation_euler = clip_pose(action_name, bn, frame, idx, len(spec['frames']))
            pb.keyframe_insert(data_path='rotation_euler', frame=frame, group=bn)
    for fc in action.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
        if spec['loop']: fc.modifiers.new('CYCLES')
    action.use_fake_user = True
    track = arm.animation_data.nla_tracks.new(); track.name = action_name
    track.strips.new(action_name, 1, action)
    arm.animation_data.action = None
# Export armature + meshes + actions. A Blender run is required to verify the final skin/animation in an engine.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_apply=True)
print('BLOCKOUT RIG EXPORTED:',out)
print('Exported clips:', ', '.join(POSES.keys()))
print('Limitations: rigid per-part weights, generated smart UVs, authored blockout clips; not mocap/AAA final animation. Blender execution and runtime import must be verified separately.')
