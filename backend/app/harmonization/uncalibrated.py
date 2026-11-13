"""Uncalibrated raw harmonization baseline.

Preserves true raw sensor observations without fabricating calibration scaling factors.
"""

from __future__ import annotations

from typing import List, Dict, Any
from app.harmonization.base import (
    HarmonizationModel,
    CalibrationParameters,
    HarmonizedActivityValue,
)


class UncalibratedHarmonizer(HarmonizationModel):
    """Reference implementation that transparently returns raw observations."""

    def __init__(self, version: str = "0.1.0-uncalibrated"):
        self.version = version

    def get_metadata(self) -> CalibrationParameters:
        return CalibrationParameters(
            version=self.version,
            reference_sensor="MODIS_AQUA",
            target_sensor="VIIRS_SNPP",
            overlap_start_year=2012,
            overlap_end_year=2024,
            spatial_tile_degrees=1.0,
            temporal_window="calendar_month",
            statistic="median_ratio",
            uncertainty_percentiles=(10.0, 90.0),
            is_validated=False,
        )

    def harmonize_series(
        self,
        date_records: List[Dict[str, Any]],
        region: str,
    ) -> List[HarmonizedActivityValue]:
        results: List[HarmonizedActivityValue] = []
        for r in date_records:
            d = r.get("date") or r.get("acq_date")
            modis_cnt = int(r.get("modis_count", 0))
            viirs_cnt = int(r.get("viirs_count", 0))

            results.append(
                HarmonizedActivityValue(
                    date=str(d),
                    observed_modis_detections=modis_cnt,
                    observed_viirs_detections=viirs_cnt,
                    harmonized_estimate=None,  # Not fabricated
                    uncertainty_lower=None,
                    uncertainty_upper=None,
                    calibration_status="uncalibrated_raw",
                    provenance_note=(
                        "Raw sensor detections preserved. Empirical MODIS/VIIRS harmonization "
                        "coefficients will be applied in Phase 2 following leave-one-year-out validation."
                    ),
                )
            )
        return results
