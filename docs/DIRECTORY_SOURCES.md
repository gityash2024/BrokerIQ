# Gurugram Area Directory

Scope confirmed by the owner: Gurugram city and its sectors; Inventory → Area Directory, retaining five main tabs.

Sources are public factual directories. No private contact data, login access, CAPTCHA bypass, or property listing images have been collected. Use `scripts/directory/fetch-public.py <private-cache>` to fetch public snapshots. The separate database import accepts only a private JSON artifact and a BrokerIQ B2B/test database.

- HARERA public register: https://haryanarera.gov.in/admincontrol/registered_projects/2. Project name, promoter, address, registration number and source status. City-address selection excludes explicit Sohna, Manesar, Pataudi, Farrukhnagar, Nuh and Tauru locations. Records without a usable city/sector address are excluded. No coordinates are invented from addresses.
- GMDA/TCP LicensedColony, public ArcGIS layer 13: https://onemapdepts.gmda.gov.in/server/rest/services/TCP_Haryana/tcp_haryana_encroachement/MapServer/13. Colony geometry, license/case identifiers, purpose and developer. The town field is the combined Gurgaon-Manesar development plan. To avoid including Manesar, geometry representative points are tested inside GMDA's publicly available **MCG Limit 2020** layer: https://onemapdepts.gmda.gov.in/server/rest/services/onemap/Boundary_GMDA/MapServer/1. This source boundary's date is retained; coverage may omit later city extensions. Do not represent it as a verified current municipal boundary.
- OpenStreetMap named apartments/residential/commercial/retail/office buildings and residential areas, filtered inside the same published boundary. © OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright. Preserve source identity and attribution. OSM centre points are not surveyed entrances.
- OFA reference: https://ofa.tcpharyana.gov.in. The public homepage is accessible, but detailed services require login/CAPTCHA. No authenticated data was collected.

Current snapshot: 865 HARERA registrations, 600 licensed-colony source records, 637 OSM named buildings/areas; 2,102 **source records**, 1,237 with source-backed coordinates. This is not 2,102 unique societies. Phases, registrations, license polygons and OSM buildings can overlap. They remain distinct until reviewed; fuzzy name or developer matches never automatically merge them. Coverage is not exhaustive and is stated in the UI.

Registration, license listing, physical possession and unit availability are separate concepts. The directory does not populate broker inventory or imply legal clearance. Provider statuses retain their original meaning.

Map rendering uses vendored Leaflet (BSD-2-Clause) and interactive OpenStreetMap tiles with attribution, normal browser caching and an identifiable native app User-Agent. No tile downloads, offline tile packs or bulk prefetch. List remains usable if tiles fail. Policy: https://operations.osmfoundation.org/policies/tiles/.
