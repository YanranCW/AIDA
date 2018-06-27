import Vue from 'vue'
import paper from 'paper'

export default {
  resetAnnotationState: state => {
    // Vuex state
    Vue.set(state, 'project', {
      name: 'An AIDA project',
      layers: []
    })

    // Remove paperJS project instance
    paper.project.remove()
  },

  // Refresh the Vuex store to incorporate all of the paperJS annotation items
  refreshAnnotationState: (state, payload) => {
    // Construct the layer structure fresh in the Vuex state
    paper.project.layers.forEach(layer => {
      if (layer.name !== 'guide') {
        Vue.set(state.project.layers, [layer.index], {
          name: state.project.layers[layer.index] ? state.project.layers[layer.index].name : layer.name,
          opacity: layer.opacity,
          items: []
        })
      }
    })

    // Gather all the Path items in the paperJS environment and store them in
    // the state appropriately. Convention follows AIDA annotation schema:
    // https://aida.gitbook.io/docs/annotation-schema
    paper.project
      .getItems({
        className: 'Path'
      })
      .forEach(item => {
        if (item.data.type === 'circle') {
          state.project.layers[item.layer.index].items.push({
            class: item.data.class,
            type: 'circle',
            center: {
              x: item.position.x,
              y: item.position.y
            },
            radius: item.bounds.width / 2
          })
        } else if (item.data.type === 'rectangle') {
          state.project.layers[item.layer.index].items.push({
            class: item.data.class,
            type: 'rectangle',
            from: {
              x: item.bounds.topLeft.x,
              y: item.bounds.topRight.y
            },
            to: {
              x: item.bounds.bottomRight.x,
              y: item.bounds.bottomRight.y
            }
          })
        } else if (item.data.type === 'path') {
          state.project.layers[item.layer.index].items.push({
            class: item.data.class,
            type: 'path',
            segments: getSegments(item),
            closed: item.closed
          })
        }
      })

    // Function that, given a paperJS path item, return the segments in the
    // format specified by the AIDA annotation schema
    function getSegments(item) {
      let segments = []
      item.segments.forEach(segment => {
        segments.push({
          point: {
            x: segment.point.x,
            y: segment.point.y
          },
          handleIn: {
            x: segment.handleIn.x,
            y: segment.handleIn.y
          },
          handleOut: {
            x: segment.handleOut.x,
            y: segment.handleOut.y
          }
        })
      })

      return segments
    }
  },

  // Setup the PaperJs instance on the canvas DOM element.
  setupAnnotation: (state, canvas) => {
    paper.setup(canvas)
  },

  // Load annotation data into both the state and the paperJS environment.
  // For legacy purposes handle both a string of annotation output as created by
  // PaperJS but also the new AIDA annotation schema.
  loadAidaAnnotation: (state, payload) => {
    // Save the loaded annotation data to the Vuex state
    state.project = payload.annotation

    // Cycle through the layers
    state.project.layers.forEach(layer => {
      // Create a new layer
      let newPaperLayer = new paper.Layer()
      newPaperLayer.opacity = layer.opacity

      // Draw each item
      if (layer.items) {
        layer.items.forEach(item => {
          let newPaperItem
          if (item.type === 'circle') {
            newPaperItem = new paper.Path.Circle({
              center: item.center,
              radius: item.radius,
              data: {
                type: 'circle',
                countable: true,
                class: item.class
              }
            })
          } else if (item.type === 'rectangle') {
            newPaperItem = new paper.Path.Rectangle({
              from: item.from,
              to: item.to,
              data: {
                type: 'rectangle',
                class: item.class
              }
            })
          } else {
            newPaperItem = new paper.Path({
              segments: item.segments,
              closed: item.closed,
              data: {
                type: 'path',
                class: item.class
              }
            })
          }

          // Set the path colors to the default for their layer.
          if (newPaperItem.closed) {
            newPaperItem.fillColor =
              state.defaultColors[newPaperItem.layer.index].fill
          }
          newPaperItem.strokeColor =
            state.defaultColors[newPaperItem.layer.index].stroke
        })
      }
    })

    // Active the correct layer as specified by editor state.
    paper.project.layers[payload.activeLayer].activate()
  },

  // Load legacy, paperJS project string representation
  loadPaperStringAnnotation: (state, payload) => {
    paper.project.importJSON(payload.annotation)
    paper.project.layers[payload.activeLayer].activate()
  },

  // Prepare the canvas for adding annotations.
  prepareCanvas: (state, rootState) => {
    // Remove the class that interrupts the pointer interaction.
    if (paper.view.element.classList.contains('pointers-no')) {
      paper.view.element.classList.remove('pointers-no')
    }

    // Ensure the correct layer is active
    paper.project.layers[rootState.editor.activeLayer].activate()
  },

  // Add a new layer to the annotation project.
  newLayer: state => {
    // Create layer in paperJS environment
    let newLayer = new paper.Layer({
      position: paper.view.center
    })
    newLayer.opacity = 1

    // Add new layer to the Vuex state representation
    state.project.layers.push({
      name: 'Layer ' + (state.project.layers.length + 1),
      opacity: 1,
      items: []
    })
  },

  // Set specified layer to be active
  setActiveLayer: (state, index) => {
    paper.project.layers[index].activate()
  },

  // Set the opacity of the active layer
  setLayerOpacity: (state, payload) => {
    let newOpacity
    // Check if keyboard event. This happens in the case that the user types
    // the opacity value in the text box and hits enter
    if (payload instanceof KeyboardEvent) {
      newOpacity = payload.target.value / 100
    } else {
      newOpacity = payload / 100
    }

    // Check if within range
    if (newOpacity > 1) {
      newOpacity = 1
    } else if (payload < 0) {
      newOpacity = 0
    }

    // Set opacity
    paper.project.activeLayer.opacity = newOpacity

    // Save changed opacity to the Vuex state.
    // Watch out for Vue Change Detection Caveats: isn't reactive to new
    // attributes being added to an object. Use Vue.set to get around this.
    Vue.set(
      state.project.layers[paper.project.activeLayer.index],
      'opacity',
      newOpacity
    )
  },

  // Set the name of the active layer
  setLayerName: (state, payload) => {
    let newName
    // Check if keyboard event. This happens in the case that the user types
    // the opacity value in the text box and hits enter
    if (payload instanceof KeyboardEvent) {
      newName = payload.target.value
    } else {
      newName = payload
    }

    // Set name
    paper.project.activeLayer.name = newName

    // Save changes to Vuex state
    Vue.set(
      state.project.layers[paper.project.activeLayer.index],
      'name',
      newName
    )
  },

  // Remove active layer
  deleteLayer: (state, payload) => {
    // Remove from Vuex state
    state.project.layers.splice(paper.project.activeLayer.index, 1)

    // Remove from paperJS project
    paper.project.activeLayer.remove()
  },

  // Set the project name
  setProjectName: (state, payload) => {
    let newName
    // Check if keyboard event. This happens in the case that the user types
    // the opacity value in the text box and hits enter
    if (payload instanceof KeyboardEvent) {
      newName = payload.target.value
    } else {
      newName = payload
    }

    state.project.name = newName
  },

  /**
   * Stores an array of the current selected items in the state
   * @function setSelectedItems
   * @param {Array} selectedItems: an array of the currently selected items
   */
  setSelectedItems: (state, selectedItems) => {
    state.selectedItems = selectedItems
  }
}