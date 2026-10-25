# Lightweight brick materials

Research and implementation: 25 October 2026.

The previous brick maps had rigid rectangular edges, conspicuous pale mortar,
and a brightness-derived bump map. That made dark bricks appear physically
lower than light bricks and gave the wall a printed grid appearance.

The revised material keeps five shared 512 x 512 sets, each with colour,
height and roughness. Colour uses sRGB; height and roughness are non-colour data.
Brick faces have independent firing-tone variation, restrained warm/cool shifts,
fine grain and larger mottling. Mortar is a muted complementary mineral colour.
The height map describes recessed joints, soft edges and shallow pores,
independently of the clay colour. Roughness varies separately between brick
faces and mortar. Existing world-space weathering adds broader variation beyond
the repeating tile.

World-space mapping uses a 1.68 x 1.168 metre tile, containing eight stretcher
modules across and sixteen courses vertically. Nominal stretcher spacing is
210 mm and course spacing is 73 mm, with joints around 8.5 mm. These are
representative proportions, not surveyed dimensions for each Toronto building.
Three finishes use half-running bond. The older brown finish has periodic
header courses; the fifth uses alternating header and stretcher courses.
Patterns repeat seamlessly, without rotating or randomly mirroring masonry.

The implementation retains the existing geometry, material count, texture count,
texture dimensions, mipmaps and capped anisotropic filtering. Fifteen RGBA8
512-pixel maps with full mip chains use approximately 20 MiB of texel storage,
the same nominal budget as before, excluding driver overhead. No photographic
downloads, displacement geometry, extra texture samplers or new per-frame
procedural layers are added. Map synthesis happens once during loading; its
startup work is greater than the former simple rectangle drawing.

A future photographic set could improve fine clay detail further, but should
use neutral, seamless albedo and matched relief/roughness maps with a known
physical size. High-resolution downloads alone do not fix scale, baked lighting,
visible repetition or exaggerated mortar. KTX2/Basis compression would require
an explicit loader/build change; it is not part of this revision.

Primary sources:

- [Three.js MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html): colour-space conventions, independent bump and roughness maps, and the distinction between lighting-only bump and geometry-changing displacement.
- [Three.js texture manual](https://threejs.org/manual/pages/textures.html): texture memory, mipmaps and filtering.
- [Poly Haven texture requirements](https://docs.polyhaven.com/en/technical-standards/textures): calibrated albedo, seamless maps, physical texture dimensions and PBR map sets.
- [Brick Industry Association Technical Note 10](https://www.gobrick.com/media/file/10-dimensioning-and-estimating-brick-masonry.pdf): nominal dimensions include mortar; consistent modules and appropriate bond patterns matter.
