import { Meteor } from 'meteor/meteor'
import { FlowRouter } from 'meteor/ostrio:flow-router-extra'
import 'jquery-serializejson'
import '@simonwep/pickr/dist/themes/monolith.min.css'
import Pickr from '@simonwep/pickr/dist/pickr.min'
import { t } from '../../utils/i18n.js'
import './editproject.html'
import Projects from '../../api/projects/projects.js'
import '../components/backbutton.js'
import '../components/wekanInterfaceSettings.js'
import '../components/projectAccessRights.js'
import { getUserSetting, getGlobalSetting, showToast } from '../../utils/frontend_helpers.js'
import CustomFields from '../../api/customfields/customfields.js'
import BsDialogs from '../components/bootstrapDialogs.js'
import '../components/projectTasks.js'

Template.editproject.onCreated(function editprojectSetup() {
  this.deletion = new ReactiveVar(false)
  this.projectId = new ReactiveVar()
  this.project = new ReactiveVar()
  this.notbillable = new ReactiveVar(false)
  this.activeTab = new ReactiveVar('definition-tab')
  this.quillReady = new ReactiveVar(false)
  this.subscribe('customfieldsForClass', { classname: 'project' })
  this.autorun(() => {
    this.projectId.set(FlowRouter.getParam('id'))
    this.project.set(Projects.findOne({ _id: this.projectId.get() }))
    this.notbillable.set(this.project.get()?.notbillable)
    if (this.projectId.get()) {
      this.handle = this.subscribe('singleProject', this.projectId.get())
    }
  })
})
Template.editproject.onRendered(() => {
  const templateInstance = Template.instance()
  const pickrOptions = {
    el: '#pickr',
    theme: 'monolith',
    lockOpacity: true,
    comparison: false,
    position: 'left-start',
    components: {
      preview: true,
      opacity: false,
      hue: true,
      interaction: {
        hex: false,
        input: false,
        clear: false,
        save: false,
      },
    },
  }
  templateInstance.autorun(() => {
    if (templateInstance.subscriptionsReady()) {
      if (!FlowRouter.getParam('id')) {
        templateInstance.color = `#${(`000000${Math.floor(0x1000000 * Math.random()).toString(16)}`).slice(-6)}`
        $('#color').val(templateInstance.color)
        pickrOptions.default = templateInstance.color
      }
      if (!templateInstance.pickr) {
        window.requestAnimationFrame(() => {
          templateInstance.pickr = Pickr.create(pickrOptions)
          templateInstance.pickr.on('change', (color) => {
            $('#color').val(color.toHEXA().toString())
          })
        })
      }
      if (!templateInstance.quill) {
        import('quill').then((quillImport) => {
          import('quill/dist/quill.snow.css')
          window.requestAnimationFrame(() => {
            if (!templateInstance.quillReady.get()) {
              templateInstance.quill = new quillImport.default('#richDesc', {
                theme: 'snow',
              })
              templateInstance.quillReady.set(true)
            }
          })
        })
      }
    }
  })
  templateInstance.autorun(() => {
    const project = templateInstance.project.get()
    if (templateInstance.handle
        && templateInstance.handle.ready() && !templateInstance.deletion.get()) {
      if (project) {
        if (project.desc instanceof Object && templateInstance.quillReady.get()) {
          templateInstance.quill.setContents(project.desc)
        } else if (project.desc && templateInstance.quillReady.get()) {
          templateInstance.quill.setText(project.desc)
        }
        Meteor.setTimeout(() => {
          for (const customfield of CustomFields.find({ classname: 'project', possibleValues: { $exists: true } })) {
            templateInstance.$(`#${customfield.name}`).val(project[customfield.name])
          }
        }, 500)
      } else if (project.desc instanceof Object && templateInstance.quill) {
        templateInstance.quill.setContents(project.desc)
      } else if (project.desc && templateInstance.quill) {
        templateInstance.quill.setText(project.desc)
      }
      if (project?.color || templateInstance.color) {
        templateInstance.pickr?.setColor(project?.color
          ? project.color : templateInstance.color)
      } else {
        templateInstance.pickr?.setColor('#009688')
      }
      if (project.desc instanceof Object && templateInstance.quill) {
        templateInstance.quill.setContents(project.desc)
      } else if (project.desc && templateInstance.quill) {
        templateInstance.quill.setText(project.desc)
      }
    } else if (FlowRouter.getRouteName() !== 'createProject' && !templateInstance.deletion) {
      FlowRouter.go('404')
    }
    if (project) {
      const userIds = project.team ? project.team : []
      if (project.admins) {
        userIds.concat(project.admins)
      }
      userIds.push(project.userId)
      templateInstance.subscribe('projectTeam', { userIds })
    }
  })
})
Template.editproject.events({
  'click .js-save': (event, templateInstance) => {
    event.preventDefault()
    if (!templateInstance.$('#name').val()) {
      templateInstance.$('#name').addClass('is-invalid')
      return
    }
    if (getUserSetting('timeunit') === 'd') {
      templateInstance.$('#target').val(Number(templateInstance.$('#target').val()) * getUserSetting('hoursToDays'))
    }
    if (getUserSetting('timeunit') === 'm') {
      templateInstance.$('#target').val(Number(templateInstance.$('#target').val()) / 60)
    }
    const projectArray = templateInstance.$('#editProjectForm').serializeArray()
    if (Template.instance().quill.getText().replace(/(\r\n|\n|\r)/gm, '')) {
      projectArray.push({ name: 'desc', value: Template.instance().quill.getContents() })
    } else {
      projectArray.push({ name: 'desc', value: '' })
    }
    if (getUserSetting('timeunit') === 'd') {
      templateInstance.$('#target').val(templateInstance.$('#target').val() * (getUserSetting('hoursToDays')))
    }
    if (getUserSetting('timeunit') === 'm') {
      templateInstance.$('#target').val(templateInstance.$('#target').val() / 60)
    }
    const selectedWekanLists = $('.js-wekan-list-entry:checked').toArray().map((entry) => entry.value)
    const selectedWekanSwimlanes = $('.js-wekan-swimlane-entry:checked').toArray().map((entry) => entry.value)
    if (selectedWekanLists.length > 0) {
      projectArray.push({ name: 'selectedWekanList', value: $('.js-wekan-list-entry:checked').toArray().map((entry) => entry.value) })
    } else if ($('#wekan-list-container').children().length > 0) {
      projectArray.push({ name: 'selectedWekanList', value: [] })
    }
    if (selectedWekanSwimlanes.length > 0) {
      projectArray.push({ name: 'selectedWekanSwimlanes', value: $('.js-wekan-swimlane-entry:checked').toArray().map((entry) => entry.value) })
    } else if ($('#wekan-swimlane-container').children().length > 0) {
      projectArray.push({ name: 'selectedWekanSwimlanes', value: [] })
    }
    if (FlowRouter.getParam('id')) {
      Meteor.call('updateProject', {
        projectId: FlowRouter.getParam('id'),
        projectArray,
      }, (error) => {
        if (!error) {
          templateInstance.$('#name').removeClass('is-invalid')
          showToast(t('notifications.project_update_success'))
        } else {
          console.error(error)
        }
      })
    } else {
      Meteor.call('createProject', {
        projectArray,
      }, (error, result) => {
        if (!error) {
          showToast(t('notifications.project_create_success'))
          FlowRouter.go('editproject', { id: result })
        } else {
          console.error(error)
        }
      })
    }
  },
  'click .js-backbutton': (event) => {
    event.preventDefault()
    FlowRouter.go('/list/projects')
  },
  'click .js-delete-project': (event) => {
    event.preventDefault()
    event.stopPropagation()
    const templateInstance = Template.instance()
    new BsDialogs().confirm('', t('notifications.project_delete_confirm')).then((result) => {
      if (result) {
        templateInstance.deletion.set(true)
        Meteor.call('deleteProject', { projectId: FlowRouter.getParam('id') }, (error) => {
          if (!error) {
            FlowRouter.go('projectlist')
            showToast(t('notifications.project_delete_success'))
          } else {
            console.error(error)
          }
        })
      }
    })
  },
  'click .js-archive-project': (event) => {
    event.preventDefault()
    event.stopPropagation()
    Meteor.call('archiveProject', { projectId: FlowRouter.getParam('id') }, (error) => {
      if (!error) {
        showToast(t('notifications.project_archive_success'))
      } else {
        console.error(error)
      }
    })
  },
  'click .js-restore-project': (event) => {
    event.preventDefault()
    event.stopPropagation()
    Meteor.call('restoreProject', { projectId: FlowRouter.getParam('id') }, (error) => {
      if (!error) {
        showToast(t('notifications.project_restore_success'))
      } else {
        console.error(error)
      }
    })
  },
  'change #color': (event, templateInstance) => {
    if (!templateInstance.$(event.currentTarget).val()) {
      templateInstance.$(event.currentTarget).val('#009688')
    }
    if (!Template.instance().pickr?.setColor(templateInstance.$(event.currentTarget).val())) {
      templateInstance.$('#color').addClass('is-invalid')
    } else {
      templateInstance.$('#color').removeClass('is-invalid')
    }
  },
  'change #notbillable': (event, templateInstance) => {
    event.preventDefault()
    templateInstance.notbillable.set(templateInstance.$(event.currentTarget).is(':checked'))
  },
  'click .nav-link[data-bs-toggle]': (event, templateInstance) => {
    templateInstance.activeTab.set(templateInstance.$(event.currentTarget)[0].id)
  },
})
Template.editproject.helpers({
  newProject: () => (!FlowRouter.getParam('id')),
  name: () => (Template.instance().project.get() ? Template.instance().project.get().name : false),
  desc: () => (Template.instance().project.get() ? Template.instance().project.get().desc : false),
  color: () => (Template.instance().project.get()
    ? Template.instance().project.get().color : Template.instance().color),
  customer: () => (Template.instance().project.get()
    ? Template.instance().project.get().customer : false),
  rate: () => (Template.instance().project.get() ? Template.instance().project.get().rate : false),
  public: () => (Template.instance().project.get() ? Template.instance().project.public : false),
  team: () => {
    if (Template.instance().project.get() && Template.instance().project.get().team) {
      return Meteor.users.find({ _id: { $in: Template.instance().project.get().team } })
    }
    return false
  },
  projectId: () => !Template.instance().deletion.get() && FlowRouter.getParam('id'),
  disablePublic: () => getGlobalSetting('disablePublicProjects'),
  archived: (_id) => (Projects.findOne({ _id }) ? Projects.findOne({ _id }).archived : false),
  target: () => (Template.instance().project.get()
    ? Template.instance().project.get().target : false),
  notbillable: () => Template.instance().notbillable.get(),
  customfields: () => (CustomFields.find({ classname: 'project' }).fetch().length > 0 ? CustomFields.find({ classname: 'project' }) : false),
  getCustomFieldValue: (fieldId) => (Template.instance().project.get()
    ? Template.instance().project.get()[fieldId] : false),
  defaultTask: () => (Template.instance().project?.get()?.defaultTask),
  isActiveTab: (tab) => Template.instance().activeTab.get() === tab,
})

Template.editproject.onDestroyed(function editprojectDestroyed() {
  this.pickr?.destroy()
  delete this.pickr
})
