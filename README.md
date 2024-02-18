# Setup project

To run the full project you need to install several dependencies:

- OpenCV (with GStreamer support)
- Python
- Node.js

If all the system dependencies are met, you can install the npm dependencies with:

```
yarn install
```

# Running the project

If everything goes well you will have an electron build. You can then start the Camera Manager app by using:

```
yarn start:dash
```

After starting the dash app, you can start the remote viewing website by running:

```
yarn start:remote
```

# Development

When working in the shared folder, you can start the watcher by running:

```
yarn watch:shared
```

This watches all the files and recompiles the shared modules when there are changes.
