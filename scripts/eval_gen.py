"""Emit one synthetic patient as JSON for the node eval harness."""
import json
import random
import sys

from gen_clinical import generate_patient_chart

seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
num_teeth = int(sys.argv[2]) if len(sys.argv) > 2 else 16
start_tooth = int(sys.argv[3]) if len(sys.argv) > 3 else 1

random.seed(seed)
transcript, truth = generate_patient_chart(num_teeth=num_teeth, start_tooth=start_tooth)
print(json.dumps({"transcript": transcript, "truth": truth}))
