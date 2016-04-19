import sys
import os
import json
import base64

import numpy as np
import cv2
from skimage.color import rgb2gray
from PIL import Image
from StringIO import StringIO
from scipy import ndimage
import os
import time

# def get_coords(binaryimg):
def get_coords(img64):
    binaryimg = base64.decodestring(img64)
    pilImage = Image.open(StringIO(binaryimg))
    image = np.array(pilImage)

    red_lower = np.array([17, 15, 100], dtype = "uint8")
    red_upper = np.array([50, 56, 200], dtype = "uint8")

    mask = cv2.inRange(image, red_lower, red_upper)
    output = cv2.bitwise_and(image, image, mask = mask)
    output_gray = rgb2gray(output)

    total_red = np.sum(output_gray)
    y, x = ndimage.center_of_mass(output_gray)

    data = {
        "x": x,
        "y": y,
        "xmax": output_gray.shape[1],
        "ymax": output_gray.shape[0],
        "total_red": total_red,
        "time": time.time()
    }
    return data

from yhat import Yhat, YhatModel

class DroneModel(YhatModel):
    REQUIREMENTS = [
        "opencv"
    ]
    def execute(self, data):
        return get_coords(data['image64'])

yh = Yhat(username, apikey, url)
yh.deploy("DroneModel", DroneModel, globals(), True)
