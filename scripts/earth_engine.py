import json
import sys
import ee

PROJECT_ID = "vayunetra-509715"
DATASET = "COPERNICUS/S5P/NRTI/L3_NO2"


def get_satellite_no2(latitude, longitude, start_date, end_date):
    ee.Initialize(project=PROJECT_ID)

    point = ee.Geometry.Point([longitude, latitude])

    image = (
        ee.ImageCollection(DATASET)
        .filterDate(start_date, end_date)
        .filterBounds(point)
        .select("tropospheric_NO2_column_number_density")
        .mean()
    )

    result = image.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=point.buffer(10000),
        scale=1000,
        maxPixels=1e8,
    ).getInfo()

    value = result.get("tropospheric_NO2_column_number_density")

    return {
        "value": value if isinstance(value, (int, float)) else None,
        "unit": "mol/m²",
        "indicator": "tropospheric_NO2_column_number_density",
        "source": "Google Earth Engine / Sentinel-5P TROPOMI",
        "measuredAt": f"{start_date} to {end_date}",
        "isSatelliteEstimate": True,
    }


if __name__ == "__main__":
    try:
        if len(sys.argv) != 5:
            raise ValueError(
                "Usage: earth_engine.py <latitude> <longitude> <start_date> <end_date>"
            )

        latitude = float(sys.argv[1])
        longitude = float(sys.argv[2])
        start_date = sys.argv[3]
        end_date = sys.argv[4]

        result = get_satellite_no2(
            latitude,
            longitude,
            start_date,
            end_date,
        )

        print(json.dumps(result))

    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
