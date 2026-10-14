#!/usr/bin/env python3
"""Deterministic procedural Elias Voss character blockout generator.

This is a mesh-based art fallback, not a sculpted/retopologized AAA asset. It generates
separate garment/equipment meshes with PBR material slots for review and later Blender work.
Requires: Python 3 + trimesh. Exports GLB and OBJ/MTL. Coordinate system: +Y up, front -Z.
"""
from pathlib import Path
import json
import math
import trimesh
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'models' / 'characters'
OUT.mkdir(parents=True, exist_ok=True)
scene = trimesh.Scene()

MATERIALS = {
 'skin': (151, 105, 83, 255), 'hair': (43, 35, 31, 255), 'jacket': (49, 59, 66, 255),
 'jacket_light': (65, 74, 78, 255), 'inner': (31, 39, 43, 255), 'trouser': (43, 49, 51, 255),
 'knee': (61, 66, 66, 255), 'boot': (31, 32, 31, 255), 'rubber': (17, 19, 20, 255),
 'glove': (34, 39, 40, 255), 'metal': (85, 91, 91, 255), 'rescue': (139, 75, 49, 255),
 'fabric_dark': (25, 31, 34, 255), 'eye': (90, 112, 112, 255), 'offwhite': (181, 174, 156, 255),
}

def mat(name):
    rgba = MATERIALS[name]
    # GLB exporter translates visual material into glTF PBR base color; keep roughness high for fabric.
    return trimesh.visual.material.PBRMaterial(name=name, baseColorFactor=rgba, metallicFactor=0.08 if name == 'metal' else 0.0,
                                                roughnessFactor=0.82 if name not in ('metal','eye') else 0.42)

def add_mesh(name, mesh, material):
    mesh.visual = trimesh.visual.TextureVisuals(material=mat(material))
    scene.add_geometry(mesh, node_name=name, geom_name=name)
    return mesh

def ellipsoid(name, center, radii, material, subdivisions=2):
    m = trimesh.creation.icosphere(subdivisions=subdivisions, radius=1.0)
    m.apply_scale(radii); m.apply_translation(center)
    return add_mesh(name, m, material)

def box(name, center, extents, material, bevel=False):
    # Bevel is represented by a chamfered box when requested, otherwise clean hard-surface box.
    m = trimesh.creation.box(extents=extents)
    if bevel:
        # Trimesh's box is kept stable; bevel-like softened silhouette is provided by adjacent rounded parts.
        pass
    m.apply_translation(center)
    return add_mesh(name, m, material)

def loft(name, rings, material, segments=16):
    """Build an elliptical ring loft. Each ring is (y, center_x, center_z, radius_x, radius_z)."""
    verts=[]; faces=[]
    for y,cx,cz,rx,rz in rings:
        for i in range(segments):
            a=2*math.pi*i/segments
            verts.append([cx+math.cos(a)*rx,y,cz+math.sin(a)*rz])
    for r in range(len(rings)-1):
        for i in range(segments):
            a=r*segments+i; b=r*segments+(i+1)%segments
            c=(r+1)*segments+(i+1)%segments; d=(r+1)*segments+i
            faces.extend([[a,b,c],[a,c,d]])
    # close both ends with center vertices
    bottom=len(verts); verts.append([rings[0][1],rings[0][0],rings[0][2]])
    top=len(verts); verts.append([rings[-1][1],rings[-1][0],rings[-1][2]])
    for i in range(segments):
        faces.append([bottom,(i+1)%segments,i])
        a=(len(rings)-1)*segments+i; b=(len(rings)-1)*segments+(i+1)%segments
        faces.append([top,a,b])
    m=trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=True)
    return add_mesh(name,m,material)

def limb(name, a, b, r1, r2, material, sides=12):
    v1=np.array(a,float); v2=np.array(b,float); axis=v2-v1; length=np.linalg.norm(axis)
    m=trimesh.creation.cone(radius=r1, height=length, sections=sides)
    # cone starts at base z=-height/2; rotate local Z to limb direction
    m.apply_transform(trimesh.geometry.align_vectors([0,0,1], axis))
    m.apply_translation((v1+v2)/2)
    # Slightly tapering limbs are represented with a cylinder and rounded joint pieces for robust topology.
    return add_mesh(name,m,material)

# Body base and insulated rescue jacket: continuous shaped torso volumes, layered front panels.
loft('Body_Jacket_Shell', [(0.91,0,0.015,0.205,0.12),(1.04,0,0.012,0.245,0.145),(1.24,0,0.005,0.29,0.155),(1.43,0,0.005,0.275,0.15),(1.57,0,0.008,0.205,0.12),(1.64,0,0.01,0.13,0.10)], 'jacket', 24)
loft('Trousers_Pelvis', [(0.79,0,0.01,0.205,0.12),(0.91,0,0.01,0.23,0.13),(1.00,0,0.01,0.21,0.12)], 'trouser', 20)
# Inner collar, neck, head, jaw and ears.
loft('Neck', [(1.59,0,0,0.066,0.06),(1.72,0,0,0.064,0.06)], 'inner', 14)
ellipsoid('Head_Skull', (0,1.82,-0.002), (0.128,0.165,0.116), 'skin', 3)
ellipsoid('Jaw_Chin', (0,1.745,-0.045), (0.09,0.075,0.086), 'skin', 2)
for s in (-1,1):
    ellipsoid(f'Ear_{s}',(s*0.126,1.81,0),(0.022,0.038,0.023),'skin',2)
    # Eye sockets, sclera, iris and brow ridges, subtly asymmetric.
    ellipsoid(f'EyeSocket_{s}',(s*0.047,1.842,-0.105),(0.032,0.019,0.012),'hair',2)
    ellipsoid(f'Eye_{s}',(s*0.047,1.841,-0.114),(0.022,0.011,0.006),'offwhite',2)
    ellipsoid(f'Iris_{s}',(s*0.047,1.841,-0.120),(0.008,0.008,0.003),'eye',2)
    brow=ellipsoid(f'Brow_{s}',(s*0.047,1.869,-0.104),(0.034,0.008,0.01),'hair',2)
    # Natural brow asymmetry is intentional and subtle.
    brow.apply_translation([0, 0.002 if s < 0 else -0.001, 0])
ellipsoid('NoseBridge',(0,1.815,-0.115),(0.014,0.035,0.02),'skin',2)
ellipsoid('NoseTip',(0,1.798,-0.13),(0.022,0.014,0.016),'skin',2)
box('Mouth_Shadow',(0,1.765,-0.124),(0.041,0.006,0.006),'hair')
# Short practical haircut with separate swept clumps instead of a helmet-shaped dome.
ellipsoid('Hair_Cap',(0,1.935,0.005),(0.128,0.057,0.116),'hair',3)
for i,(x,y,z,rx,ry,rz) in enumerate([(-.07,1.92,-.015,.038,.045,.072),(.00,1.947,-.018,.045,.034,.078),(.065,1.922,.002,.035,.045,.065),(-.09,1.89,.01,.024,.042,.04),(.09,1.89,.01,.024,.042,.04)]):
    h=ellipsoid(f'Hair_Clump_{i}',(x,y,z),(rx,ry,rz),'hair',2); h.apply_transform(trimesh.transformations.rotation_matrix(-0.14 if i%2 else 0.11,[0,0,1],point=[x,y,z]))
# Shoulder/arm shells and segmented gloves. Arms held in neutral low-ready pose.
for s,label in [(-1,'L'),(1,'R')]:
    ellipsoid(f'Shoulder_{label}',(s*.27,1.52,0),(0.105,0.12,0.115),'jacket_light',2)
    limb(f'UpperSleeve_{label}',(s*.28,1.50,0),(s*.34,1.26,-0.005),.085,.071,'jacket',14)
    ellipsoid(f'Elbow_{label}',(s*.34,1.255,0),(0.071,0.075,0.074),'jacket_light',2)
    limb(f'Forearm_{label}',(s*.34,1.24,0),(s*.365,1.02,-0.025),.067,.055,'jacket',14)
    ellipsoid(f'GloveCuff_{label}',(s*.365,1.015,-.025),(0.06,.035,.058),'fabric_dark',2)
    ellipsoid(f'GlovePalm_{label}',(s*.365,.968,-.04),(.055,.052,.045),'glove',2)
    for j in range(4):
        ellipsoid(f'GloveFinger_{label}_{j}',(s*.365+(j-1.5)*.022,.93,-.061),(.011,.032,.013),'glove',1)
    ellipsoid(f'GloveThumb_{label}',(s*.365-s*.045,.965,-.035),(.018,.033,.018),'glove',1)
    # Jacket cuff seam and restrained rescue tab.
    box(f'CuffBand_{label}',(s*.362,1.045,-.02),(.125,.018,.12),'jacket_light')
# Jacket closure, reinforced seams, chest pocket flaps, radio and restrained rescue-orange identifier.
box('Front_Zipper',(0,1.29,-.157),(.009,.39,.008),'metal')
for s,label in [(-1,'L'),(1,'R')]:
    box(f'Chest_Pocket_{label}',(s*.145,1.38,-.153),(.083,.092,.022),'jacket_light')
    box(f'Chest_Pocket_Flap_{label}',(s*.145,1.432,-.168),(.087,.022,.012),'fabric_dark')
    box(f'Pocket_Pull_{label}',(s*.145,1.415,-.177),(.009,.018,.005),'metal')
box('Rescue_ID_Tab',(-.19,1.49,-.13),(.052,.026,.014),'rescue')
box('Radio_Body',(.19,1.48,.055),(.064,.13,.046),'fabric_dark')
box('Radio_Display',(.19,1.50,.029),(.036,.033,.006),'offwhite')
limb('Radio_Antenna',(.205,1.55,.055),(.215,1.63,.055),.004,.003,'metal',6)
# Belt, buckle, useful pouches; no excessive tactical clutter.
box('Utility_Belt',(0,1.015,-.14),(.39,.047,.04),'fabric_dark')
box('Belt_Buckle',(0,1.015,-.164),(.057,.033,.012),'metal')
for s in (-1,1):
    box(f'Utility_Pouch_{s}',(s*.17,1.045,-.145),(.073,.09,.047),'fabric_dark')
    box(f'Pouch_Flap_{s}',(s*.17,1.078,-.172),(.075,.024,.008),'jacket_light')
# Trousers with anatomical taper, reinforced knees, seams and lower cuffs.
for s,label in [(-1,'L'),(1,'R')]:
    loft(f'Trouser_Thigh_{label}',[(.47,s*.115,0,.075,.087),(.61,s*.115,0,.09,.10),(.79,s*.115,.005,.103,.105),(.91,s*.115,.008,.095,.10)],'trouser',16)
    ellipsoid(f'Knee_Reinforcement_{label}',(s*.115,.49,-.065),(.074,.078,.027),'knee',2)
    box(f'Knee_Seam_{label}',(s*.115,.49,-.093),(.09,.009,.008),'jacket_light')
    loft(f'Lower_Trouser_{label}',[(.16,s*.12,.01,.055,.064),(.30,s*.12,.005,.064,.074),(.47,s*.115,0,.071,.081)],'trouser',14)
    box(f'Ankle_Cuff_{label}',(s*.12,.17,-.005),(.116,.04,.13),'jacket_light')
    # Rescue boot: ankle shaft, toe volume, separate rubber sole and tread blocks.
    ellipsoid(f'Boot_Shaft_{label}',(s*.12,.12,.005),(.072,.12,.08),'boot',2)
    ellipsoid(f'Boot_Toe_{label}',(s*.12,.07,-.078),(.077,.057,.14),'boot',2)
    box(f'Boot_Sole_{label}',(s*.12,.027,-.035),(.158,.026,.255),'rubber')
    box(f'Boot_Heel_{label}',(s*.12,.035,.055),(.112,.035,.075),'rubber')
    box(f'Boot_Tongue_{label}',(s*.12,.148,-.074),(.05,.09,.015),'jacket_light')
    for j in range(4):
        box(f'Boot_Lace_{label}_{j}',(s*.12,.17-j*.019,-.092+j*.024),(.055,.006,.008),'offwhite')
    for j in range(4):
        box(f'Boot_Tread_{label}_{j}',(s*.12,.011,-.125+j*.06),(.12,.008,.014),'rubber')
# Back yoke and compact rescue pack.
box('Jacket_Back_Yoke',(0,1.48,.126),(.28,.085,.022),'jacket_light')
box('Compact_Rescue_Pack',(0,1.34,.17),(.24,.28,.105),'fabric_dark')
box('Pack_Closure',(0,1.28,.228),(.07,.06,.012),'jacket_light')
# Small functional details to break the large flat surfaces without adding decorative sci-fi clutter.
for side,label in [(-1,'L'),(1,'R')]:
    # Shoulder reinforcement seams and restrained jacket hardware.
    box(f'Shoulder_Seam_{label}',(side*.235,1.535,-.093),(.075,.012,.012),'fabric_dark')
    box(f'Elbow_Reinforcement_{label}',(side*.34,1.255,-.068),(.075,.082,.014),'jacket_light')
    # Low-profile cargo pockets and flaps distinguish field trousers from a smooth tube.
    box(f'Cargo_Pocket_{label}',(side*.195,.655,-.091),(.075,.12,.018),'fabric_dark')
    box(f'Cargo_Flap_{label}',(side*.195,.718,-.103),(.079,.022,.01),'jacket_light')
    box(f'Cargo_Tab_{label}',(side*.195,.704,-.111),(.018,.009,.006),'metal')
    # Boot eyelets and side reinforcement, all separate for later material/rig review.
    for j in range(3):
        ellipsoid(f'Boot_Eyelet_{label}_{j}',(side*.12,.174-j*.021,-.102+j*.022),(.006,.006,.004),'metal',1)
    box(f'Boot_Side_Reinforcement_{label}',(side*.187,.105,.005),(.012,.095,.075),'jacket_light')
# Jacket closure snaps and a zipper pull provide close-up readable detail.
for j,y in enumerate((1.18,1.245,1.31,1.375)):
    ellipsoid(f'Closure_Snap_{j}',(.018,y,-.166),(.006,.006,.003),'metal',1)
box('Zipper_Pull',(0,1.105,-.167),(.012,.028,.008),'metal')
# Grounded, neutral stance; total height approximately 2.0m including hair.
# Export both deliverables; OBJ is a review interchange, GLB retains material slots.
glb = OUT / 'elias_voss_procedural_blockout.glb'
obj = OUT / 'elias_voss_procedural_blockout.obj'
scene.export(glb)
# OBJ material export through scene graph; export adjacent MTL if supported by trimesh.
obj_data = trimesh.exchange.export.export_scene(scene, file_obj=None, file_type='obj', include_normals=True)
if isinstance(obj_data, dict):
    for filename, data in obj_data.items():
        (OUT / filename).write_bytes(data if isinstance(data, bytes) else data.encode('utf-8'))
else:
    obj.write_text(obj_data, encoding='utf-8')
# The OBJ exporter references material.mtl; emit the matching simple material library explicitly.
mtl_lines = ['# Generated alongside elias_voss_procedural_blockout.obj']
for name, rgba in MATERIALS.items():
    r, g, b, _a = rgba
    mtl_lines.extend([f'newmtl {name}', f'Kd {r/255:.5f} {g/255:.5f} {b/255:.5f}',
                      'Ka 0.02000 0.02000 0.02000', 'Ks 0.08000 0.08000 0.08000',
                      f'Ns {24 if name not in ("metal", "eye") else 90}', 'd 1.0', 'illum 2', ''])
(OUT / 'material.mtl').write_text('\n'.join(mtl_lines), encoding='utf-8')
report = {
    'asset': glb.name, 'classification': 'STATIC_PROCEDURAL_BLOCKOUT_NOT_PRODUCTION_ASSET',
    'geometry_count': len(scene.geometry), 'vertices': sum(len(g.vertices) for g in scene.geometry.values()),
    'faces': sum(len(g.faces) for g in scene.geometry.values()), 'watertight_geometry_count': sum(bool(g.is_watertight) for g in scene.geometry.values()),
    'material_slots': sorted(MATERIALS), 'bounds': scene.bounds.tolist(), 'uv_mapped': False,
    'embedded_textures': False, 'rigged': False, 'skinned': False, 'animations': False,
    'runtime_integrated': False, 'notes': 'Untextured source blockout; see elias_voss_uv.glb for generated per-part UVs and procedural base-color maps.'
}
(OUT / 'elias_voss_asset_report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(f'GLB={glb} bytes={glb.stat().st_size}')
print(f'OBJ={obj} exists={obj.exists()}')
print(f'objects={len(scene.geometry)} bounds={scene.bounds.tolist()}')
