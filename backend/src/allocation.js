// How fully the live resources are deployed. A resource's total allocation
// is the sum of its live deployment percentages, and it falls in one bucket:
//   full     exactly 100
//   partial  above 0 and below 100
//   none     no live deployment at all
//   over     above 100, which the allocation rule should make impossible and
//            which is reported only so a broken rule cannot hide
// Soft-deleted resources and deployments are left out everywhere.
export const BUCKETS = ["full", "partial", "none", "over"];

const MAX_POSITIONS = 50;

// `placed` is one row per resource and position name. A resource deployed
// twice to positions with the same name counts once for that name.
const PEOPLE = `
  with totals as (
    select employee_id, sum(allocation_percentage) as total
      from resource_deployment
     where deleted_at is null
     group by employee_id
  ),
  people as (
    select r.employee_id,
           case when t.total is null then 'none'
                when t.total > 100 then 'over'
                when t.total = 100 then 'full'
                else 'partial' end as bucket
      from resources r
      left join totals t on t.employee_id = r.employee_id
     where r.deleted_at is null
  ),
  placed as (
    select distinct rd.employee_id, p.name as position
      from resource_deployment rd
      join positions p on p.code = rd.position_code
     where rd.deleted_at is null
  )`;

// Each side is filtered by the other's pick and never by its own, so every
// slice and bar stays visible and can be switched. $1 is the bucket and
// $2 is the position name, either may be null.
const BUCKET_COUNTS = `${PEOPLE}
  select pe.bucket as key, count(*)::int as count
    from people pe
   where ($1::text is null or exists (
           select 1 from placed pl
            where pl.employee_id = pe.employee_id and pl.position = $1::text))
   group by pe.bucket`;

const POSITION_COUNTS = `${PEOPLE}
  select pl.position as value, count(*)::int as count
    from placed pl
    join people pe on pe.employee_id = pl.employee_id
   where ($1::text is null or pe.bucket = $1::text)
   group by pl.position
   order by count desc, pl.position asc
   limit ${MAX_POSITIONS}`;

export async function loadAllocationSummary(query, { bucket = null, position = null } = {}) {
  const [buckets, positions] = await Promise.all([
    query(BUCKET_COUNTS, [position]),
    query(POSITION_COUNTS, [bucket]),
  ]);
  const counts = new Map(buckets.rows.map((row) => [row.key, row.count]));
  return {
    // Always all four buckets in a fixed order, so the page never has to
    // guess whether a missing one means zero.
    buckets: BUCKETS.map((key) => ({ key, count: counts.get(key) ?? 0 })),
    positions: positions.rows,
  };
}
