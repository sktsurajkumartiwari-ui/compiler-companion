# Runner images

Build and review these images in CI, then publish them to a private registry with immutable digests. Local developer commands:

```sh
docker build -t compiler-companion-python:latest ./python
docker build -t compiler-companion-cpp:latest ./cpp
```

The API adds runtime isolation. Production should also use a hardened Docker host or a stronger isolation runtime such as gVisor/Firecracker, registry scanning, and an outbound-deny policy at the host level.
