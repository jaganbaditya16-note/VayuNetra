
export default function MapPage() {
  const [hotspots, setHotspots] = useState<NormalizedHotspot[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);

    fetch("/api/hotspots")
      .then((response) => response.json())
      .then((data) => {
        const values: NormalizedHotspot[] = Array.isArray(data?.hotspots)
          ? data.hotspots.map((spot: RawHotspot, index: number) =>
              normalize(spot, index),
            )
          : [];

        setHotspots(values);

        const requestedId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("hotspot")
            : null;

        setSelectedId(
          requestedId && values.some((item) => item.id === requestedId)
            ? requestedId
            : values[0]?.id,
        );
      })
      .catch(() => {
        setHotspots([]);
        setSelectedId(undefined);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;

    fetch("/api/hotspots")
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;

        const values = Array.isArray(data?.hotspots)
          ? data.hotspots.map((spot: RawHotspot, index: number) =>
              normalize(spot, index),
            )
          : [];

        setHotspots(values);

        const requestedId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("hotspot")
            : null;

        setSelectedId(
          requestedId && values.some((item) => item.id === requestedId)
            ? requestedId
            : values[0]?.id,
        );
      })
      .catch(() => {
        if (!active) return;
        setHotspots([]);
        setSelectedId(undefined);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(