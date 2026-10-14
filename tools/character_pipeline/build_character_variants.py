#!/usr/bin/env python3
"""Build UV-bearing static GLB review variants from the canonical character blockout.
These are design/blockout variants, not unique sculpted production characters or rigged assets.
Requires Python 3 + trimesh + numpy. UVs are per-part projections, not a packed atlas.
"""
from pathlib import Path
import json, copy
import numpy as np
from PIL import Image
import trimesh
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'public'/'models'/'characters'
SOURCE = OUT/'elias_voss_procedural_blockout.glb'

PALETTES = {
 'elias_voss_uv': {'skin':(151,105,83,255),'hair':(43,35,31,255),'jacket':(49,59,66,255),'jacket_light':(65,74,78,255),'inner':(31,39,43,255),'trouser':(43,49,51,255),'knee':(61,66,66,255),'boot':(31,32,31,255),'rubber':(17,19,20,255),'glove':(34,39,40,255),'metal':(85,91,91,255),'rescue':(139,75,49,255),'fabric_dark':(25,31,34,255),'eye':(90,112,112,255),'offwhite':(181,174,156,255)},
 'dana_voss_blockout': {'skin':(176,132,112,255),'hair':(54,42,38,255),'jacket':(105,121,127,255),'jacket_light':(139,151,151,255),'inner':(58,67,71,255),'trouser':(74,78,78,255),'knee':(92,98,96,255),'boot':(47,48,46,255),'rubber':(20,22,23,255),'glove':(48,53,54,255),'metal':(94,101,101,255),'rescue':(151,111,82,255),'fabric_dark':(39,47,51,255),'eye':(82,113,119,255),'offwhite':(213,211,198,255)},
 'mara_vale_blockout': {'skin':(159,116,94,255),'hair':(38,38,37,255),'jacket':(55,75,84,255),'jacket_light':(79,101,108,255),'inner':(30,42,47,255),'trouser':(46,55,58,255),'knee':(64,75,76,255),'boot':(30,34,35,255),'rubber':(17,19,20,255),'glove':(32,40,42,255),'metal':(94,106,108,255),'rescue':(177,122,58,255),'fabric_dark':(24,34,38,255),'eye':(82,120,129,255),'offwhite':(181,180,165,255)},
 'warden_faction_blockout': {'skin':(145,103,83,255),'hair':(34,31,29,255),'jacket':(43,49,43,255),'jacket_light':(61,67,57,255),'inner':(27,31,28,255),'trouser':(42,47,39,255),'knee':(60,65,54,255),'boot':(25,27,24,255),'rubber':(14,16,15,255),'glove':(29,32,28,255),'metal':(78,82,75,255),'rescue':(123,63,47,255),'fabric_dark':(24,28,24,255),'eye':(85,101,94,255),'offwhite':(164,158,139,255)},
 'drifter_faction_blockout': {'skin':(157,113,91,255),'hair':(49,39,32,255),'jacket':(88,78,63,255),'jacket_light':(112,99,79,255),'inner':(48,44,38,255),'trouser':(75,67,54,255),'knee':(94,82,66,255),'boot':(45,39,32,255),'rubber':(18,17,15,255),'glove':(52,45,37,255),'metal':(102,95,82,255),'rescue':(128,92,55,255),'fabric_dark':(39,36,30,255),'eye':(88,106,105,255),'offwhite':(174,158,133,255)},
 'fractured_faction_blockout': {'skin':(151,111,96,255),'hair':(55,47,43,255),'jacket':(80,82,81,255),'jacket_light':(107,108,103,255),'inner':(48,51,51,255),'trouser':(64,67,65,255),'knee':(83,85,81,255),'boot':(37,39,38,255),'rubber':(16,17,17,255),'glove':(43,45,44,255),'metal':(91,94,91,255),'rescue':(120,94,78,255),'fabric_dark':(35,38,37,255),'eye':(103,111,108,255),'offwhite':(168,164,154,255)},
 'collector_faction_blockout': {'skin':(148,106,84,255),'hair':(41,34,28,255),'jacket':(74,70,52,255),'jacket_light':(99,91,66,255),'inner':(40,39,32,255),'trouser':(60,57,43,255),'knee':(80,74,55,255),'boot':(34,31,25,255),'rubber':(15,15,13,255),'glove':(38,36,29,255),'metal':(95,88,69,255),'rescue':(140,97,50,255),'fabric_dark':(31,31,25,255),'eye':(91,103,91,255),'offwhite':(172,158,132,255)},
 'veil_research_faction_blockout': {'skin':(174,131,111,255),'hair':(57,52,48,255),'jacket':(178,181,177,255),'jacket_light':(207,208,199,255),'inner':(102,112,116,255),'trouser':(112,119,120,255),'knee':(135,139,137,255),'boot':(50,54,55,255),'rubber':(17,19,20,255),'glove':(76,84,86,255),'metal':(110,123,127,255),'rescue':(82,121,136,255),'fabric_dark':(50,59,62,255),'eye':(92,119,127,255),'offwhite':(226,226,214,255)},
 'kessel_security_faction_blockout': {'skin':(153,113,95,255),'hair':(34,32,31,255),'jacket':(35,43,52,255),'jacket_light':(55,65,75,255),'inner':(24,30,37,255),'trouser':(35,42,49,255),'knee':(54,61,67,255),'boot':(24,28,32,255),'rubber':(12,14,16,255),'glove':(28,33,38,255),'metal':(83,91,98,255),'rescue':(99,107,111,255),'fabric_dark':(20,25,31,255),'eye':(86,109,119,255),'offwhite':(176,177,171,255)},
 'friendly_survivor_faction_blockout': {'skin':(166,122,100,255),'hair':(63,49,39,255),'jacket':(93,92,76,255),'jacket_light':(123,119,98,255),'inner':(54,58,51,255),'trouser':(71,73,60,255),'knee':(92,91,73,255),'boot':(42,40,33,255),'rubber':(17,17,15,255),'glove':(44,43,36,255),'metal':(100,98,83,255),'rescue':(129,111,77,255),'fabric_dark':(35,37,30,255),'eye':(95,115,111,255),'offwhite':(187,178,153,255)},
}

def uv_project(mesh, palette, variant):
    v=np.asarray(mesh.vertices,dtype=float); lo=v.min(axis=0); hi=v.max(axis=0); span=np.maximum(hi-lo,1e-8)
    # Per-part dominant-plane projection is suitable for a textured blockout; a packed atlas is still needed for production.
    axes=np.argsort(span)[-2:]
    uv=(v[:,axes]-lo[axes])/span[axes]
    uv=uv*0.96+0.02
    old=mesh.visual; oldmat=getattr(old,'material',None); mat_name=getattr(oldmat,'name','')
    rgba=palette.get(mat_name,(110,110,110,255)); seed=sum(ord(c) for c in (variant+mat_name)); rng=np.random.default_rng(seed)
    size=128; base=np.empty((size,size,3),dtype=np.float32); base[:,:,:]=np.array(rgba[:3],dtype=np.float32)
    # Subtle deterministic micro-variation makes material response readable without pretending to be scanned PBR.
    noise=rng.normal(0,2.6 if mat_name not in ('skin','eye','metal') else 1.5,(size,size,1))
    yy,xx=np.indices((size,size)); weave=((xx%4==0).astype(float)-0.25)*1.3 if mat_name in ('jacket','jacket_light','trouser','fabric_dark','glove') else 0
    grain=np.sin(yy*0.45)*1.0 if mat_name=='metal' else 0
    detail=weave[:,:,None] if isinstance(weave,np.ndarray) else (grain[:,:,None] if isinstance(grain,np.ndarray) else 0)
    rgb=np.clip(base+noise+detail,0,255).astype(np.uint8)
    image=Image.fromarray(rgb,'RGB')
    pbr=trimesh.visual.material.PBRMaterial(name=mat_name or 'blockout',baseColorFactor=[255,255,255,255],baseColorTexture=image,
      metallicFactor=0.65 if mat_name=='metal' else 0.02,roughnessFactor=0.48 if mat_name in ('metal','eye') else (0.9 if mat_name in ('fabric_dark','trouser','jacket','jacket_light','glove') else 0.82))
    mesh.visual=trimesh.visual.TextureVisuals(uv=uv, material=pbr)

def build(name,palette):
    scene=trimesh.load(SOURCE,force='scene')
    keep=[]
    for node in list(scene.graph.nodes_geometry):
        geom_name = scene.graph[node][1]
        if name=='dana_voss_blockout' and any(x in geom_name for x in ('Compact_Rescue_Pack','Pack_Closure','Radio_','Utility_Pouch','Pouch_Flap')):
            scene.delete_geometry(geom_name); continue
        if name=='mara_vale_blockout' and any(x in geom_name for x in ('Compact_Rescue_Pack','Pack_Closure')):
            # Mara keeps field radio but carries a smaller, lower-profile pack.
            g=scene.geometry[geom_name]; g.vertices[:,0]*=0.65; g.vertices[:,1]=1.34+(g.vertices[:,1]-1.34)*0.72
        if name=='dana_voss_blockout' and geom_name.startswith('Hair_'):
            g=scene.geometry[geom_name]; g.vertices[:,1]=1.89+(g.vertices[:,1]-1.89)*1.42; g.vertices[:,2]*=1.08
        g=scene.geometry[geom_name]
        material=getattr(g.visual,'material',None); mat_name=getattr(material,'name','')
        if mat_name in palette and material is not None:
            rgba=palette[mat_name]
            try: material.baseColorFactor=np.array(rgba,dtype=np.uint8)
            except Exception: pass
            try: material.name=mat_name
            except Exception: pass
        uv_project(g,palette,name); keep.append(geom_name)
    if name=='mara_vale_blockout':
        # Compact headset earpieces and band; explicitly separate geometry for later rigging.
        for side in (-1,1):
            m=trimesh.creation.icosphere(subdivisions=2,radius=1)
            m.apply_scale([.018,.027,.016]); m.apply_translation([side*.132,1.82,0.0]);
            m.visual=trimesh.visual.TextureVisuals(uv=np.zeros((len(m.vertices),2)),material=trimesh.visual.material.PBRMaterial(name='metal',baseColorFactor=[94,106,108,255],roughnessFactor=.55))
            scene.add_geometry(m,node_name=f'Comms_Earpiece_{side}',geom_name=f'Comms_Earpiece_{side}')
    out=OUT/f'{name}.glb'; scene.export(out)
    loaded=trimesh.load(out,force='scene')
    uv_count=sum(1 for g in loaded.geometry.values() if getattr(g.visual,'uv',None) is not None)
    report={'asset':name,'source':'elias_voss_procedural_blockout.glb','classification':'STATIC_PROCEDURAL_BLOCKOUT_VARIANT_NOT_PRODUCTION_ASSET','geometry_count':len(loaded.geometry),'uv_geometry_count':uv_count,'uv_method':'per-part dominant-plane projection; not a packed texture atlas','base_color_textures':'embedded deterministic procedural material maps with subtle grain; not scanned/photo-real PBR maps','rigged':False,'skinned':False,'runtime_integrated':False,'unique_sculpt':False,'notes':('Dana variant removes Elias-specific rescue pack and pouches and extends hair blockout; silhouette remains a placeholder, not a final human sculpt.' if name=='dana_voss_blockout' else 'Mara variant uses a cool communications palette and simple headset blockout.' if name=='mara_vale_blockout' else 'Faction palette blockout derived from shared base silhouette; role-specific geometry is not complete.')}
    (OUT/f'{name}_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(name, out.stat().st_size, 'meshes',len(loaded.geometry),'uv',uv_count)

if __name__=='__main__':
    for n,p in PALETTES.items(): build(n,p)
