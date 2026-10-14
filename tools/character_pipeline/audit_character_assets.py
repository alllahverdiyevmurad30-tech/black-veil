#!/usr/bin/env python3
"""Read-only audit for generated BLACK VEIL character GLBs. Requires trimesh + numpy."""
from pathlib import Path
import json, struct
import trimesh
ROOT=Path(__file__).resolve().parents[2]
DIR=ROOT/'public'/'models'/'characters'
files=sorted(DIR.glob('*.glb'))
rows=[]
for path in files:
    scene=trimesh.load(path,force='scene')
    data=path.read_bytes(); declared=struct.unpack_from('<I',data,8)[0]
    jlen=struct.unpack_from('<I',data,12)[0]; doc=json.loads(data[20:20+jlen].decode('utf-8').rstrip(' \0'))
    geos=list(scene.geometry.values()); uv=sum(getattr(g.visual,'uv',None) is not None for g in geos)
    row={'file':path.name,'bytes':len(data),'glb_v2':data[:4]==b'glTF' and struct.unpack_from('<I',data,4)[0]==2 and declared==len(data),
      'geometries':len(geos),'uv_geometries':uv,'watertight_geometries':sum(bool(g.is_watertight) for g in geos),
      'vertices':sum(len(g.vertices) for g in geos),'faces':sum(len(g.faces) for g in geos),'materials':len(doc.get('materials',[])),
      'embedded_images':len(doc.get('images',[])),'skins':len(doc.get('skins',[])),'animations':len(doc.get('animations',[])),
      'bounds':scene.bounds.tolist() if scene.bounds is not None else None}
    rows.append(row)
report={'classification':'PROCEDURAL_STATIC_BLOCKOUT_AUDIT_NOT_PRODUCTION_ASSET_APPROVAL','count':len(rows),'assets':rows,
 'limitations':['No Blender execution occurred in this environment.','No rig, skinning, facial rig, or animation is claimed for these generated GLBs.','UVs are generated per-part projections, not a packed production atlas.','Embedded base-color maps are procedural micro-variation, not scanned/photo-real textures.','Runtime rendering and visual QA require a real browser/WebGL session.']}
out=DIR/'character_asset_audit.json'; out.write_text(json.dumps(report,indent=2),encoding='utf-8')
for r in rows: print(f"{r['file']}: {r['geometries']} meshes, UV {r['uv_geometries']}, textures {r['embedded_images']}, rigged {bool(r['skins'])}, {r['bytes']} bytes")
print('audit:',out,'assets:',len(rows))
